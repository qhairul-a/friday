import { speak } from '@/lib/tts'

// SpeechSynthesisUtterance is not available in jsdom — mock it globally
const mockUtteranceInstance = { text: '', rate: 1, pitch: 1 }
const MockSpeechSynthesisUtterance = jest.fn().mockImplementation((text: string) => {
  mockUtteranceInstance.text = text
  return mockUtteranceInstance
})

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance,
  writable: true,
})

describe('speak', () => {
  it('calls speechSynthesis.speak with correct text', () => {
    const mockSpeak = jest.fn()
    const mockCancel = jest.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak: mockSpeak, cancel: mockCancel },
      writable: true,
    })
    speak('Hello Qasim')
    expect(mockCancel).toHaveBeenCalled()
    expect(mockSpeak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello Qasim' }))
  })

  it('does nothing when speechSynthesis is not available', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true })
    expect(() => speak('test')).not.toThrow()
  })
})
