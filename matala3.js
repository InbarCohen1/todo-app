const express = require('express');
const app = express();
app.use(express.json());

function TODO(title, content, dueDate) {
    this.id = counterID++;
    this.title = title;
    this.content = content;
    this.status = 'PENDING';
    this.dueDate = dueDate;
  }

let counterID = 1;
let arrayOfTodo = [];


//1
app.get("/todo/health",  (req, res) => {
    res.status(200).send('OK');
});



//2
app.post("/todo", (req, res) => {

    let date = new Date(req.body.dueDate);

    if(arrayOfTodo.find(elem => (elem.title == req.body.title)))
        res.status(409).json({errorMessage: "Error: TODO with the title [" + req.body.title + "] already exists in the system"});
    else if (date.getTime() < Date.now()) 
        res.status(409).json({errorMessage: "Error: Can’t create new TODO that its due date is in the past"});         
    else
    {
        let newTODO = new TODO(req.body.title, req.body.content, req.body.dueDate);
        arrayOfTodo.push(newTODO);
        res.status(200).json({result: newTODO.id});
    } 
});



//3
app.get("/todo/size", (req, res) => {

    const { status } = req.query;

    if(status === 'ALL')
        res.status(200).json({result: arrayOfTodo.length});
    else if(status === 'PENDING')
        res.status(200).json({result: sameStatusCounter(arrayOfTodo, 'PENDING')});
    else if(status === 'LATE')
        res.status(200).json({result: sameStatusCounter(arrayOfTodo, 'LATE')});
    else if(status === 'DONE')
        res.status(200).json({result: sameStatusCounter(arrayOfTodo, 'DONE')});
    else
        res.status(400).json({errorMessage: "bad request"}); 
});

function sameStatusCounter(arr, item) 
{
  let numOfStatus = 0;

  for (let i = 0; i < arr.length; i++) 
    if (arr[i].status === item) 
        numOfStatus++;

  return numOfStatus;
}



//4
app.get("/todo/content", (req, res) => {

    const { status, sortBy } = req.query;
    let sortedArr = [];

    if(status === 'ALL') 
        sortedArr = arrayOfTodo;
    else if(status === 'DONE')
        sortedArr = arrayOfTodo.filter((elem) => elem.status === 'DONE');
    else if(status === 'PENDING')
        sortedArr = arrayOfTodo.filter((elem) => elem.status === 'PENDING');
    else if(status === 'LATE')
        sortedArr = arrayOfTodo.filter((elem) => elem.status === 'LATE');
    else
        res.status(400).json({errorMessage: "bad request"}); 

    if(sortBy === 'DUE_DATE')
        res.status(200).json({result: sortedArr.sort((elem1, elem2) => elem1.dueDate - elem2.dueDate)});
    else if(sortBy === 'ID' || sortBy === undefined)
        res.status(200).json({result: sortedArr.sort((elem1, elem2) => elem1.id - elem2.id)});
    else if(sortBy === 'TITLE')
        res.status(200).json({result: sortedArr.sort((elem1, elem2) => elem1.title.localeCompare(elem2.title))});
    else
        res.status(400).json({errorMessage: "bad request"}); 
});


function findIndex(array, sentId)
{
    for (let i = 0; i < array.length; i++)
        if(array[i].id == sentId)
            return i;

    return undefined;
} 



//5
app.put("/todo", (req, res) => {

    const { id, status } = req.query;
    let foundIndex = findIndex(arrayOfTodo, id);
    
    if(foundIndex === undefined)
    {
        res.status(404).json({errorMessage: "Error: no such TODO with id " + id});
    } 
    else
    {
        if(status !== 'PENDING' && status !== 'DONE' && status !== 'LATE')
        {
            res.status(400).json({errorMessage: "bad request"});
        }
        else
        {
            let prevStatus = arrayOfTodo[foundIndex].status;
            arrayOfTodo[foundIndex].status = status;
            res.status(200).json({result: prevStatus});
        }
    }
});


//6
app.delete("/todo", (req, res) => {

    const { id } = req.query;
    let ind = findIndex(arrayOfTodo, id);

    if(ind === undefined)
    {
        res.status(404).json({errorMessage: "Error: no such TODO with id " + id});
    }
    else
    {
        arrayOfTodo.splice(ind, 1);
        res.status(200).json({result: arrayOfTodo.length});
    }
});


app.listen(9285,  () =>
{
    console.log('Server listening on port 9285');
});