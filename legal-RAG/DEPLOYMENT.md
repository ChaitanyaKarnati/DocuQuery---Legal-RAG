# Deployment Guide for DocuQuery

This guide covers deploying the DocuQuery application to Google Cloud Run using Docker.

## Architecture

The application runs both the Next.js frontend and the Python PDF service in a single Docker container:
- **Python Service** runs on port 8000 (internal)
- **Next.js App** runs on port 8080 (exposed to Cloud Run)
- Both services communicate internally via localhost

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Qdrant Cloud** instance or self-hosted Qdrant
3. **OpenAI API Key**
4. **Google Cloud CLI** installed and configured

## Local Docker Testing

### Build the Docker image

```bash
docker build -t docuquery .
```

### Run locally

```bash
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=your-key \
  -e QDRANT_URL=your-qdrant-url \
  -e QDRANT_API_KEY=your-qdrant-key \
  -e QDRANT_COLLECTION=legal_docs \
  docuquery
```

### Test the application

Open http://localhost:8080 in your browser.

## Deploy to Cloud Run

### Option 1: Manual Deployment

1. **Authenticate with Google Cloud**

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

2. **Build and push the image to Google Container Registry**

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/docuquery
```

3. **Deploy to Cloud Run**

```bash
gcloud run deploy docuquery \
  --image gcr.io/YOUR_PROJECT_ID/docuquery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars OPENAI_API_KEY=your-key,QDRANT_URL=your-url,QDRANT_API_KEY=your-key,QDRANT_COLLECTION=legal_docs,PYTHON_SERVICE_URL=http://localhost:8000
```

### Option 2: Using Cloud Build (Automated)

1. **Set up Cloud Build trigger** (in Google Cloud Console):
   - Connect your GitHub/GitLab repository
   - Configure trigger on push to main branch
   - Use the `cloudbuild.yaml` file in this repo

2. **Set environment variables** in Cloud Run:
   - Go to Cloud Run console
   - Select your service
   - Click "Edit & Deploy New Revision"
   - Add environment variables:
     - `OPENAI_API_KEY`
     - `QDRANT_URL`
     - `QDRANT_API_KEY`
     - `QDRANT_COLLECTION`
     - `PYTHON_SERVICE_URL=http://localhost:8000`

### Option 3: Using the deployment script

```bash
# Set your variables
export PROJECT_ID=your-project-id
export OPENAI_API_KEY=your-key
export QDRANT_URL=your-url
export QDRANT_API_KEY=your-key

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/docuquery && \
gcloud run deploy docuquery \
  --image gcr.io/$PROJECT_ID/docuquery \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --update-env-vars OPENAI_API_KEY=$OPENAI_API_KEY,QDRANT_URL=$QDRANT_URL,QDRANT_API_KEY=$QDRANT_API_KEY,QDRANT_COLLECTION=legal_docs,PYTHON_SERVICE_URL=http://localhost:8000
```

## Configuration

### Required Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for embeddings and queries
- `QDRANT_URL`: URL to your Qdrant instance
- `QDRANT_API_KEY`: API key for Qdrant (optional for local instances)
- `QDRANT_COLLECTION`: Collection name (default: `legal_docs`)
- `PYTHON_SERVICE_URL`: URL to Python service (default: `http://localhost:8000`)

### Cloud Run Settings Recommendations

- **Memory**: 2Gi (minimum recommended for PDF processing)
- **CPU**: 2 (for parallel processing)
- **Max Instances**: 10 (adjust based on expected load)
- **Timeout**: 300s (5 minutes for large PDF uploads)
- **Port**: 8080

## Monitoring

### Health Checks

- Next.js: `http://your-app-url/`
- Python Service: `http://your-app-url/` (internal health check in startup script)

### Logs

View logs in Cloud Run console or using CLI:

```bash
gcloud run services logs read docuquery --region us-central1
```

### Common Issues

1. **Python service not starting**
   - Check logs for port conflicts
   - Verify Python dependencies are installed

2. **Next.js can't connect to Python service**
   - Ensure `PYTHON_SERVICE_URL=http://localhost:8000`
   - Check startup script is waiting for Python service

3. **Out of memory errors**
   - Increase memory allocation to 4Gi or 8Gi
   - Reduce PDF size limits in `python-service/main.py`

4. **Timeout errors**
   - Increase Cloud Run timeout setting
   - Optimize chunking strategy for faster processing

## Cost Optimization

- Use **minimum instances: 0** to scale to zero when not in use
- Set **max instances** based on expected traffic
- Monitor Cloud Run billing in Google Cloud Console
- Consider using Cloud Run's **CPU allocation** setting to reduce costs

## Security Best Practices

1. **Store secrets in Google Secret Manager** instead of environment variables
2. **Enable authentication** for production deployments
3. **Restrict CORS** in Python service to your domain only
4. **Use Cloud Armor** for DDoS protection
5. **Enable VPC** for private Qdrant instances

## Rollback

If you need to rollback to a previous version:

```bash
gcloud run services update-traffic docuquery \
  --to-revisions=REVISION_NAME=100 \
  --region us-central1
```

## Updating the Application

To deploy updates:

1. Push changes to your repository
2. Cloud Build will automatically build and deploy (if configured)
3. Or manually run: `gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/docuquery`

## Support

For issues or questions:
- Check Cloud Run logs
- Review Qdrant connection settings
- Verify OpenAI API key is valid
- Consult the main README.md for application-specific help
