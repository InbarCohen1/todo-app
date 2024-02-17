docker-compose down
docker build -t inbarcohen/kaplat-backend-instance:latest .
docker push inbarcohen/kaplat-backend-instance:latest
docker-compose up -d  