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
