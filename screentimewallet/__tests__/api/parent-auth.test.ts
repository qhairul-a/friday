/**
 * @jest-environment node
 */
import { POST } from '@/app/api/parent-auth/route'
import { NextRequest } from 'next/server'

describe('POST /api/parent-auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, PARENT_PIN: '1234' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 200 and sets cookie when PIN is correct', async () => {
    const req = new NextRequest('http://localhost/api/parent-auth', {
      method: 'POST',
      body: JSON.stringify({ pin: '1234' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('parent_session=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('returns 401 when PIN is wrong', async () => {
    const req = new NextRequest('http://localhost/api/parent-auth', {
      method: 'POST',
      body: JSON.stringify({ pin: '9999' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
