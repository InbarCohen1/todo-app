const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const express = require('express');

const IS_LOCAL_DEBUG_MODE = false;

const MONGO_HOST_NAME = IS_LOCAL_DEBUG_MODE ? 'localhost' : 'mongo';
const POSTGRES_HOST_NAME = IS_LOCAL_DEBUG_MODE ? 'localhost' :'postgres';

// - Postgres DB -
const pool = new Pool({
    user: 'postgres',
    password: 'docker',
    database: 'todos',
    host: POSTGRES_HOST_NAME,
    port: 5432
});

const PostgresExecuteQuery = async (query, params) => {
    const client = await pool.connect();

    try {
        const result = await client.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error executing query in postgres:', error);
        throw error;
    } finally {
        client.release();
    }
};

// - Mongo DB -
const client = new MongoClient(`mongodb://${MONGO_HOST_NAME}:27017`, { useUnifiedTopology: true });
client.connect();

const database = client.db('todos');
const mongoCollection = database.collection('todos');

// HTTP controller
const app = express();
app.use(express.json());

// 1 - Health
app.get("/todo/health",  (req, res) => {
    res.status(200).send('OK');
});

// 2 - Create new TODO
app.post("/todo", async (req, res) => {

    try{
        // Get the number of todos until now
        const allTodos = await PostgresExecuteQuery('SELECT * FROM todos;', []);

        let rawid = allTodos.length + 1;
        let title = req.body.title;
        let content = req.body.content;
        let dueDate =  req.body.dueDate;
        let state = 'PENDING';

        if(allTodos.find(elem => (elem.title == title))){
            res.status(409).json({errorMessage: "Error: TODO with the title [" + title + "] already exists in the system"});
        }
        else if (dueDate < Date.now()){
            res.status(409).json({errorMessage: "Error: Can’t create new TODO that its due date is in the past"});         
        } 
        else
        {       
            // - POSTGRES -
            let query = 'INSERT INTO todos (rawid, title, content, duedate, state) VALUES ($1, $2, $3, $4, $5)';
            let params = [rawid, title, content, dueDate, state];
            await PostgresExecuteQuery(query, params);

            // - MONGO -
            const documentToInsert = {
                rawid: rawid,
                title: title,
                content: content,
                duedate: dueDate,
                state: state,
            };
            await mongoCollection.insertOne(documentToInsert);

            res.status(200).json({result: rawid});
        } 
    }
    catch (error){
        res.status(400).json({errorMessage: error.message}); 
    }
});

// 3 - Get todos count
app.get("/todo/size", async (req, res) => {
    try{
        const { status, persistenceMethod } = req.query;
        let numberOfTodos = 0;
    
        if(persistenceMethod === 'POSTGRES'){
            
            let query = '';
            let params = [];

            if(status === 'ALL'){
                query = 'SELECT * FROM todos;';
                params = [];
            }
            else{
                query = 'SELECT * FROM todos WHERE state = $1;';
                params = [status];
            }
            
            const result = await PostgresExecuteQuery(query, params);
            numberOfTodos = result.length;
        }
        else if (persistenceMethod === 'MONGO'){
            if(status === 'ALL'){
                const result = await mongoCollection.find({}).toArray();
                numberOfTodos = result.length;
            }
            else{
                const result = await mongoCollection.find({ state: status }).toArray();
                numberOfTodos = result.length;
            }
        }
        else{
            throw new Error(`Invalid persistenceMethod - ${persistenceMethod}`);
        }
        
        return res.status(200).json({result: numberOfTodos});
    }
    catch (error){
        res.status(400).json({errorMessage: error.message}); 
    }
});

//4 - Get todos data
app.get("/todo/content", async (req, res) => {

    try{
        const { status, sortBy, persistenceMethod } = req.query;
       
        let sortByColumnLowerCase = sortBy.toLowerCase();
        let result = [];

        if(persistenceMethod === 'POSTGRES'){

            let query = '';
            let params = [];

            if(status === 'ALL'){
                query = `SELECT * FROM todos ORDER BY ${sortByColumnLowerCase};`;
                params = [];
            }
            else{
                query = `SELECT * FROM todos WHERE state = $1 ORDER BY ${sortByColumnLowerCase};`;
                params = [status];
            }

            result = await PostgresExecuteQuery(query, params);
        }
        else if (persistenceMethod === 'MONGO'){
            const sortOrder = 1; // 1 for ascending, -1 for descending

            const sortCriteria = {};
            sortCriteria[sortByColumnLowerCase] = sortOrder;

            if(status === 'ALL'){
                result = await mongoCollection.find({}).sort(sortCriteria).toArray();
            }
            else{
                result = await mongoCollection.find({ state: status }).sort(sortCriteria).toArray();
            }
        }
        else{
            throw new Error(`Invalid persistenceMethod - ${persistenceMethod}`);
        }

        // Change rawid key to id
        const updatedResult = result.map((item) => {
            // Check if the dictionary has the 'rawid' key
            if ('rawid' in item) {
                // Create a new dictionary with 'id' instead of 'rawid'
                return { id: item['rawid'], ...item };
            }
            return item; // No change if 'rawid' key is not present
        });
        return res.status(200).json({result: updatedResult});
    }
    catch (error){
        res.status(400).json({errorMessage: error.message}); 
    }
});

// 5 - Update TODO status
app.put("/todo", async (req, res) => {
    try{
        const { id, status } = req.query;

        if(status !== 'PENDING' && status !== 'DONE' && status !== 'LATE')
        {
            res.status(400).json({errorMessage: "bad request"});
        }

        // - POSTGRES -
        let query = 'SELECT * FROM todos WHERE rawid = $1;';
        let params = [id];

        let result = await PostgresExecuteQuery(query, params);

        if(result.length == 0){
            res.status(404).json({errorMessage: "Error: no such TODO with id " + id});
        }

        let prevState = result[0]['state'];

        query = 'UPDATE todos SET state = $1 WHERE rawid = $2;';
        params = [status, id];
        result = await PostgresExecuteQuery(query, params);

        // - MONGO -
        const filter  = { rawid: parseInt(id) };
        const update = { $set: { state: status } };
        await mongoCollection.updateOne(filter, update);

        res.status(200).json({result: prevState});
    }
    catch (error){
        res.status(400).json({errorMessage: error.message}); 
    }
});

// 6 - Delete TODO 
app.delete("/todo", async (req, res) => {
    try{
        const { id } = req.query;

        // - POSTGRES -
        let query = 'SELECT * FROM todos WHERE rawid = $1;';
        let params = [id];
        let result = await PostgresExecuteQuery(query, params);

        if(result.length == 0){
            res.status(404).json({errorMessage: "Error: no such TODO with id " + id});
        }

        query = 'DELETE FROM todos WHERE rawid = $1;';
        params = [id];
        await PostgresExecuteQuery(query, params);

        // - MONGO -
        const filter  = { rawid: parseInt(id) };
        await mongoCollection.deleteOne(filter);

        // - POSTGRES -
        query = 'SELECT * FROM todos;';
        result = await PostgresExecuteQuery(query, []);

        res.status(200).json({result: result.length});
    }
    catch (error){
        res.status(400).json({errorMessage: error.message}); 
    }
});

let PORT = IS_LOCAL_DEBUG_MODE ? 3769 : 9285;
app.listen(PORT,  () =>
{
    console.log(`Server listening on port ${PORT}`);
});