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
    version: '2.0.0',
    description: 'API documentation for the Courier Call Masking System (Milestone 2). This API allows couriers to initiate masked calls to customers, handles incoming calls, tracks call status, and provides admin functionality for daily resets and system management.',
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
      name: 'Authentication',
      description: 'User authentication and session management. These endpoints are provided by Supabase Auth. Base URL: {SUPABASE_URL}/auth/v1. Replace {SUPABASE_URL} with your Supabase project URL.',
    },
    {
      name: 'Calls',
      description: 'Call management endpoints',
    },
    {
      name: 'Webhooks',
      description: 'Twilio webhook endpoints for call handling',
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints for system management',
    },
    {
      name: 'System',
      description: 'System health and status endpoints',
    },
  ],
  paths: {
    '/auth/v1/signup': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Creates a new user account via Supabase Auth. **Note:** This endpoint is at `{SUPABASE_URL}/auth/v1/signup` where {SUPABASE_URL} is your Supabase project URL. New users are automatically assigned the "courier" role. Returns a session with access token that can be used for authenticated API requests.',
        operationId: 'signUp',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    description: 'User email address',
                    example: 'courier@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 6,
                    description: 'User password (minimum 6 characters)',
                    example: 'securepassword123',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'Optional phone number in E.164 format (e.g., +1234567890)',
                    example: '+1234567890',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          format: 'uuid',
                          description: 'User ID',
                        },
                        email: {
                          type: 'string',
                          format: 'email',
                        },
                      },
                    },
                    session: {
                      type: 'object',
                      properties: {
                        access_token: {
                          type: 'string',
                          description: 'JWT access token for API authentication',
                        },
                        refresh_token: {
                          type: 'string',
                          description: 'Refresh token for obtaining new access tokens',
                        },
                        expires_in: {
                          type: 'integer',
                          description: 'Token expiration time in seconds',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid input or user already exists',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'User already registered',
                },
              },
            },
          },
        },
      },
    },
    '/auth/v1/token': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in user',
        description: 'Authenticates a user and returns a session with access token. **Note:** This endpoint is at `{SUPABASE_URL}/auth/v1/token` where {SUPABASE_URL} is your Supabase project URL. Use the access token in the Authorization header for subsequent API requests.',
        operationId: 'signIn',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    description: 'User email address',
                    example: 'courier@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    description: 'User password',
                    example: 'securepassword123',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          format: 'uuid',
                          description: 'User ID',
                        },
                        email: {
                          type: 'string',
                          format: 'email',
                        },
                      },
                    },
                    session: {
                      type: 'object',
                      properties: {
                        access_token: {
                          type: 'string',
                          description: 'JWT access token - use in Authorization: Bearer header',
                          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        },
                        refresh_token: {
                          type: 'string',
                          description: 'Refresh token for obtaining new access tokens',
                        },
                        expires_in: {
                          type: 'integer',
                          description: 'Token expiration time in seconds',
                          example: 3600,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Invalid login credentials',
                },
              },
            },
          },
        },
      },
    },
    '/auth/v1/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign out user',
        description: 'Signs out the current user and invalidates the session. **Note:** This endpoint is at `{SUPABASE_URL}/auth/v1/logout`. Requires authentication.',
        operationId: 'signOut',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Sign out successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Signed out successfully',
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
              },
            },
          },
        },
      },
    },
    '/auth/v1/user': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns the currently authenticated user information. **Note:** This endpoint is at `{SUPABASE_URL}/auth/v1/user`. Requires a valid access token.',
        operationId: 'getUser',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'User information retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      description: 'User ID',
                    },
                    email: {
                      type: 'string',
                      format: 'email',
                      description: 'User email address',
                    },
                    created_at: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Account creation timestamp',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or expired token',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'JWT expired',
                },
              },
            },
          },
        },
      },
    },
    '/api/call/initiate': {
      post: {
        tags: ['Calls'],
        summary: 'Initiate a masked call',
        description: 'Initiates a call from a courier to a customer. The courier\'s phone number is masked, and they never see the customer\'s phone number. Automatically logs the call attempt and sets up status callbacks for real-time updates.',
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
        summary: 'Call connection webhook',
        description: 'Internal endpoint used by Twilio to connect calls. When the courier answers, this endpoint generates TwiML to dial the customer with caller ID masking (customer sees business number, not courier\'s real number).',
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
    '/api/call/incoming': {
      post: {
        tags: ['Webhooks'],
        summary: 'Handle incoming calls',
        description: 'Twilio webhook endpoint that handles incoming calls to the business number. Plays a configurable message informing callers this is an outbound-only number.',
        operationId: 'handleIncomingCall',
        security: [
          {
            twilioWebhook: [],
          },
        ],
        responses: {
          '200': {
            description: 'TwiML response with message playback',
            content: {
              'text/xml': {
                schema: {
                  type: 'string',
                  example: '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">This number is for outbound calls only. Please wait for our agent to call you.</Say><Hangup/></Response>',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid Twilio signature',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'Unauthorized',
                },
              },
            },
          },
        },
      },
    },
    '/api/call/status': {
      post: {
        tags: ['Webhooks'],
        summary: 'Call status callback',
        description: 'Twilio webhook endpoint that receives call status updates (ringing, connected, completed, failed, etc.) and updates the call logs accordingly.',
        operationId: 'updateCallStatus',
        security: [
          {
            twilioWebhook: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  CallSid: {
                    type: 'string',
                    description: 'Twilio Call SID',
                    example: 'CA1234567890abcdef1234567890abcdef',
                  },
                  CallStatus: {
                    type: 'string',
                    enum: ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'failed', 'canceled'],
                    description: 'Current call status from Twilio',
                  },
                  CallDuration: {
                    type: 'string',
                    description: 'Call duration in seconds (only present for completed calls)',
                    example: '120',
                  },
                  From: {
                    type: 'string',
                    description: 'Caller phone number',
                  },
                  To: {
                    type: 'string',
                    description: 'Called phone number',
                  },
                  ErrorMessage: {
                    type: 'string',
                    description: 'Error message if call failed',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status update processed successfully',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'OK',
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Missing CallSid',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'Missing CallSid',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid Twilio signature',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'Unauthorized',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: 'Internal Server Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/admin/reset': {
      post: {
        tags: ['Admin'],
        summary: 'Daily reset endpoint',
        description: 'Archives current day\'s call logs and deactivates all customers. Can be triggered manually by admins or automatically by cron jobs. Requires admin authentication or valid cron secret.',
        operationId: 'dailyReset',
        security: [
          {
            bearerAuth: [],
          },
          {
            cronSecret: [],
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: {
                    type: 'string',
                    description: 'Supabase access token (required for manual admin reset)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Reset completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    message: {
                      type: 'string',
                      example: 'Daily reset completed successfully',
                    },
                    archived_calls: {
                      type: 'integer',
                      description: 'Number of call logs archived',
                      example: 42,
                    },
                    reset_date: {
                      type: 'string',
                      format: 'date',
                      example: '2024-01-15',
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
                  error: 'Unauthorized',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden - User is not an admin',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'Only admins can reset the list',
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
                example: {
                  error: 'Reset failed: Database error',
                },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        description: 'Checks the health status of the system, including Twilio connection and database connectivity. Useful for monitoring and debugging.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    twilio_configured: {
                      type: 'boolean',
                      description: 'Whether Twilio credentials are configured',
                      example: true,
                    },
                    twilio_connected: {
                      type: 'boolean',
                      description: 'Whether Twilio API is accessible',
                      example: true,
                    },
                    database_connected: {
                      type: 'boolean',
                      description: 'Whether database connection is working',
                      example: true,
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Timestamp of health check',
                      example: '2024-01-15T12:00:00.000Z',
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service unavailable - One or more services are down',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    twilio_configured: {
                      type: 'boolean',
                      example: true,
                    },
                    twilio_connected: {
                      type: 'boolean',
                      example: false,
                    },
                    database_connected: {
                      type: 'boolean',
                      example: true,
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Health check failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Health check failed',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
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
        description: 'Supabase JWT access token. Obtain by calling /auth/v1/token or /auth/v1/signup. Include in Authorization header as: "Bearer {access_token}"',
      },
      twilioWebhook: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Twilio-Signature',
        description: 'Twilio webhook signature for request validation. Automatically included by Twilio.',
      },
      cronSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Cron-Secret',
        description: 'Secret token for cron job authentication. Must match CRON_SECRET environment variable.',
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
      CallLog: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Call log ID',
          },
          customer_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Customer ID',
          },
          customer_name: {
            type: 'string',
            nullable: true,
            description: 'Customer name',
          },
          customer_phone_masked: {
            type: 'string',
            nullable: true,
            description: 'Masked customer phone (last 4 digits only)',
            example: '****7890',
          },
          courier_id: {
            type: 'string',
            format: 'uuid',
            description: 'Courier/agent ID',
          },
          agent_name: {
            type: 'string',
            nullable: true,
            description: 'Agent name or email',
          },
          call_status: {
            type: 'string',
            enum: ['attempted', 'ringing', 'connected', 'completed', 'failed', 'no-answer', 'busy', 'incoming_blocked'],
            description: 'Current call status',
          },
          call_timestamp: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the call was initiated',
          },
          call_duration: {
            type: 'integer',
            nullable: true,
            description: 'Call duration in seconds (only for completed calls)',
          },
          twilio_call_sid: {
            type: 'string',
            nullable: true,
            description: 'Twilio Call SID for reference',
          },
          error_message: {
            type: 'string',
            nullable: true,
            description: 'Error message if call failed',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'When the log entry was created',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the log entry was last updated',
          },
        },
      },
      AuthRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 6,
            description: 'User password',
          },
          phone_number: {
            type: 'string',
            description: 'Optional phone number in E.164 format',
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              email: {
                type: 'string',
                format: 'email',
              },
            },
          },
          session: {
            type: 'object',
            properties: {
              access_token: {
                type: 'string',
                description: 'JWT access token for API authentication',
              },
              refresh_token: {
                type: 'string',
                description: 'Refresh token',
              },
              expires_in: {
                type: 'integer',
                description: 'Token expiration in seconds',
              },
            },
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

