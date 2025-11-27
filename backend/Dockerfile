# backend/Dockerfile
FROM python:3.9-slim

# Set working directory to /app (representing project root)
WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend code and config structure
COPY . ./backend
# We will mount config and data via docker-compose to keep them persistent

# Expose Flask port
EXPOSE 5000

# Run from the "root" context as per your README instructions
CMD ["python", "backend/app.py"]
