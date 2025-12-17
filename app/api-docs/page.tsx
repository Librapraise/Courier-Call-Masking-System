'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div className="p-8 text-center">Loading API documentation...</div>
})

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Courier Call Masking System API',
    version: '1.0.0',
    description: 'API documentation for the Courier Call Masking System. This API allows couriers to initiate masked calls to customers without exposing phone numbers.',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Calls',
      description: 'Call management endpoints',
    },
  ],
  paths: {
    '/api/call/initiate': {
      post: {
        tags: ['Calls'],
        summary: 'Initiate a masked call',
        description: 'Initiates a call from a courier to a customer. The courier\'s phone number is masked, and they never see the customer\'s phone number.',
        operationId: 'initiateCall',
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['customerId', 'accessToken'],
                properties: {
                  customerId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'UUID of the customer to call',
                    example: '123e4567-e89b-12d3-a456-426614174000',
                  },
                  accessToken: {
                    type: 'string',
                    description: 'Supabase access token for authentication',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Call initiated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    callSid: {
                      type: 'string',
                      description: 'Twilio Call SID',
                      example: 'CA1234567890abcdef1234567890abcdef',
                    },
                    message: {
                      type: 'string',
                      example: 'Call initiated successfully',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid parameters or configuration',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                examples: {
                  missingParameter: {
                    value: {
                      error: 'Missing required parameter: customerId',
                    },
                  },
                  invalidWebhookUrl: {
                    value: {
                      error: 'Twilio webhook URL must be publicly accessible. For local development, use ngrok or deploy to a public URL.',
                      details: 'Current URL: http://localhost:3000/api/call/connect?customerPhone=%2B1234567890',
                    },
                  },
                  noPhoneNumber: {
                    value: {
                      error: 'Courier phone number not configured',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Unauthorized - Please log in',
                  details: 'Session not found',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden - User is not a courier',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Only couriers can initiate calls',
                },
              },
            },
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Customer not found',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                examples: {
                  twilioError: {
                    value: {
                      error: 'Failed to initiate call: Url is not a valid URL',
                    },
                  },
                  serverError: {
                    value: {
                      error: 'Internal server error',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/call/connect': {
      post: {
        tags: ['Calls'],
        summary: 'Twilio webhook endpoint',
        description: 'Internal endpoint used by Twilio to connect calls. This endpoint receives Twilio webhook requests and generates TwiML to bridge the courier and customer.',
        operationId: 'connectCall',
        parameters: [
          {
            name: 'customerPhone',
            in: 'query',
            required: true,
            description: 'Customer phone number in E.164 format',
            schema: {
              type: 'string',
              pattern: '^\\+[1-9]\\d{1,14}$',
              example: '+1234567890',
            },
          },
        ],
        responses: {
          '200': {
            description: 'TwiML response for call connection',
            content: {
              'text/xml': {
                schema: {
                  type: 'string',
                  example: '<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="+1234567890"><Number>+1987654321</Number></Dial></Response>',
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Missing customer phone number',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Customer phone number required',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT access token. Get this from the frontend session after logging in.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          details: {
            type: 'string',
            description: 'Additional error details',
          },
        },
        required: ['error'],
      },
      CallInitiateRequest: {
        type: 'object',
        required: ['customerId', 'accessToken'],
        properties: {
          customerId: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the customer to call',
          },
          accessToken: {
            type: 'string',
            description: 'Supabase access token for authentication',
          },
        },
      },
      CallInitiateResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
          callSid: {
            type: 'string',
            description: 'Twilio Call SID',
          },
          message: {
            type: 'string',
          },
        },
      },
    },
  },
}

export default function ApiDocsPage() {
  useEffect(() => {
    // Load Swagger UI CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css'
    document.head.appendChild(link)

    return () => {
      // Cleanup on unmount
      document.head.removeChild(link)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
          <p className="mt-2 text-gray-600">
            Interactive API documentation for the Courier Call Masking System
          </p>
        </div>
        <SwaggerUI spec={swaggerSpec} />
      </div>
    </div>
  )
}

