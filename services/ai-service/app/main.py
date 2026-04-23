from fastapi import FastAPI

app = FastAPI(title="AI Service API", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "AI Service is up and running!"}
