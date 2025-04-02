
# Courier Route Optimization API

A FastAPI service that optimizes courier routes using Google Routes API and OR-Tools.

## Features

- Calculates optimal routes for a fleet of courier drivers over 5 days
- Respects constraints like driver availability and collection/delivery ordering
- Handles time windows and location-based optimization
- Provides detailed route planning with time estimates

## Requirements

- Python 3.11+
- Google Maps API key (for distance matrix calculations)
- Docker (for containerized deployment)

## Local Development

1. Clone the repository
2. Create a `.env` file based on `.env.example` with your API keys
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```
   uvicorn main:app --reload
   ```
5. Access the API at http://localhost:8000 and documentation at http://localhost:8000/docs

## API Endpoints

### POST /api/optimize

Optimizes courier routes based on job locations and constraints.

**Request Body:**
```json
{
  "jobs": [
    {
      "id": "job1",
      "location": "123 High St, Birmingham, UK",
      "type": "collection",
      "related_job_id": "job2",
      "preferred_date": ["2023-06-01T00:00:00Z"]
    }
  ],
  "drivers": [
    {
      "id": "driver1",
      "available_hours": 9
    }
  ],
  "num_drivers_per_day": 2
}
```

**Response:**
```json
{
  "routes": [
    {
      "driver_id": "driver1",
      "day": 1,
      "stops": [
        {
          "job_id": "job1",
          "window": [60, 240]
        }
      ],
      "total_time": 180
    }
  ],
  "unassigned": ["job3"]
}
```

## Deployment on Fly.io

1. Install the Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. Authenticate with Fly:
   ```
   fly auth login
   ```

3. Deploy the application:
   ```
   fly launch --dockerfile Dockerfile
   ```

4. Set environment variables:
   ```
   fly secrets set API_KEY=your_secure_api_key_here
   fly secrets set GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

5. Monitor the deployment:
   ```
   fly status
   ```

## Integration with Node.js Backend

To integrate with your existing Node.js backend:

1. Deploy this FastAPI service separately on Fly.io
2. Create an API gateway in your Node.js app that forwards requests to the routing service
3. Example Node.js code for forwarding requests:

```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Environment variables
const ROUTING_API_URL = process.env.ROUTING_API_URL;
const ROUTING_API_KEY = process.env.ROUTING_API_KEY;

// Route optimization endpoint
router.post('/optimize-routes', async (req, res) => {
  try {
    const response = await axios.post(`${ROUTING_API_URL}/api/optimize`, req.body, {
      headers: {
        'X-API-KEY': ROUTING_API_KEY
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Route optimization error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Route optimization failed',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;
```

## Security Considerations

- Always use HTTPS for production
- Protect your API key and set strong secrets
- Consider adding rate limiting for production use
