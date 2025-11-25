// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import 'whatwg-fetch'

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables for tests
process.env.SERVICE_TOKEN_SECRET = 'test-service-token-secret-1234567890abcdef1234567890abcdef'
process.env.STRIPE_SECRET_KEY = 'sk_test_123456789'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123456789'
process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_test'
process.env.STRIPE_PRICE_ID_PRO = 'price_pro_test'
process.env.STRIPE_PRICE_ID_MAX = 'price_max_test'
process.env.STRIPE_PRICE_ID_TOPUP_500 = 'price_topup_test'

// OAuth environment variables
process.env.TOKEN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
process.env.TIKAPI_KEY = 'test_tikapi_key_12345'
process.env.NEXT_PUBLIC_TIKAPI_CLIENT_ID = 'c_test_client_id'

// Setup database mocks globally
jest.mock('@pixell/db-mysql')
jest.mock('@pixell/db-mysql/schema')

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234-5678-90ab-cdef12345678'),
}))
