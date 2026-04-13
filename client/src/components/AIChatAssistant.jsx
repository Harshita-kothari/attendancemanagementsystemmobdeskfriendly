import { Bot, LoaderCircle, Send, Sparkles, User, Volume2 } from 'lucide-react'
import { useState } from 'react'
import api from '../lib/api'

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'fr', label: 'French' },
]

const ASSISTANT_COPY = {
  en: {
    introStudent: 'I am the VisionOS AI assistant. I can explain your attendance, low-attendance reasons, latest check-in, and upcoming academic events.',
    introTeacher: 'I am the VisionOS AI assistant. I can explain dashboard summaries, suspicious alerts, parent notifications, and attendance trends.',
    placeholder: 'Type your question...',
    thinking: 'The assistant is thinking...',
    responseLanguage: 'Response language',
    suggestions: {
      student: ['What is my attendance percentage?', 'Why is my attendance low?', 'What is the next academic event?'],
      teacher: ['Show me the dashboard summary', 'Which students have low attendance?', 'What suspicious activity was detected recently?'],
    },
  },
  hinglish: {
    introStudent: 'Main VisionOS AI assistant hoon. Main aapki attendance, low-attendance reasons, latest check-in, aur upcoming academic events explain kar sakta hoon.',
    introTeacher: 'Main VisionOS AI assistant hoon. Main dashboard summaries, suspicious alerts, parent notifications, aur attendance trends explain kar sakta hoon.',
    placeholder: 'Apna question type karo...',
    thinking: 'Assistant soch raha hai...',
    responseLanguage: 'Response language',
    suggestions: {
      student: ['Meri attendance percentage kya hai?', 'Meri attendance low kyu hai?', 'Next academic event kya hai?'],
      teacher: ['Dashboard summary dikhao', 'Kin students ki attendance low hai?', 'Recent suspicious activity kya detect hui?'],
    },
  },
  hi: {
    introStudent: 'मैं VisionOS AI assistant हूँ। मैं आपकी attendance, low-attendance reasons, latest check-in और upcoming academic events समझा सकता हूँ।',
    introTeacher: 'मैं VisionOS AI assistant हूँ। मैं dashboard summaries, suspicious alerts, parent notifications और attendance trends समझा सकता हूँ।',
    placeholder: 'अपना प्रश्न लिखें...',
    thinking: 'Assistant सोच रहा है...',
    responseLanguage: 'Response language',
    suggestions: {
      student: ['मेरी attendance percentage क्या है?', 'मेरी attendance low क्यों है?', 'अगला academic event क्या है?'],
      teacher: ['Dashboard summary दिखाइए', 'किन students की attendance low है?', 'हाल की suspicious activity क्या है?'],
    },
  },
  mr: {
    introStudent: 'मी VisionOS AI assistant आहे. मी तुमची attendance, low-attendance reasons, latest check-in आणि upcoming academic events समजावू शकतो.',
    introTeacher: 'मी VisionOS AI assistant आहे. मी dashboard summaries, suspicious alerts, parent notifications आणि attendance trends समजावू शकतो.',
    placeholder: 'तुमचा प्रश्न टाइप करा...',
    thinking: 'Assistant विचार करत आहे...',
    responseLanguage: 'Response language',
    suggestions: {
      student: ['माझी attendance percentage किती आहे?', 'माझी attendance low का आहे?', 'पुढचा academic event कोणता आहे?'],
      teacher: ['Dashboard summary दाखवा', 'कोणत्या students ची attendance low आहे?', 'अलीकडे कोणती suspicious activity detect झाली?'],
    },
  },
  fr: {
    introStudent: 'Je suis l’assistant IA VisionOS. Je peux expliquer votre attendance, les raisons de low-attendance, le dernier check-in et les prochains academic events.',
    introTeacher: 'Je suis l’assistant IA VisionOS. Je peux expliquer les dashboard summaries, les suspicious alerts, les parent notifications et les attendance trends.',
    placeholder: 'Tapez votre question...',
    thinking: 'L’assistant réfléchit...',
    responseLanguage: 'Response language',
    suggestions: {
      student: ['Quel est mon pourcentage de attendance ?', 'Pourquoi ma attendance est-elle basse ?', 'Quel est le prochain academic event ?'],
      teacher: ['Montrez le dashboard summary', 'Quels students ont une low attendance ?', 'Quelle suspicious activity a été détectée récemment ?'],
    },
  },
}

export function AIChatAssistant({ role = 'student' }) {
  const [language, setLanguage] = useState('en')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: ASSISTANT_COPY.en[role === 'teacher' ? 'introTeacher' : 'introStudent'],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('local')
  const copy = ASSISTANT_COPY[language] || ASSISTANT_COPY.en

  async function sendMessage(prefilledMessage) {
    const message = String(prefilledMessage ?? input).trim()
    if (!message || loading) return

    const nextMessages = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/api/chat', {
        message,
        history: nextMessages.slice(-8),
        language,
      })

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.answer,
        },
      ])
      setMode(data.mode || 'local')
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error.response?.data?.message || 'The assistant is not available right now. Please try again shortly.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="card-panel p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">AI Chatbot Assistant</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              It explains attendance data, low-attendance reasons, and makes the system more interactive.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${mode === 'openai' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            {mode === 'openai' ? 'AI live' : 'Smart local'}
          </span>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">How it works</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="mt-0.5 text-blue-500" />
              <p>It pulls live attendance context from the backend and explains it in simple language.</p>
            </div>
            <div className="flex items-start gap-3">
              <Volume2 size={16} className="mt-0.5 text-cyan-500" />
              <p>It uses personal stats for students and summaries, alerts, and trends for teachers.</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Quick asks</p>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{copy.responseLanguage}</span>
              <select
                value={language}
                onChange={(event) => {
                  const nextLanguage = event.target.value
                  const nextCopy = ASSISTANT_COPY[nextLanguage] || ASSISTANT_COPY.en
                  setLanguage(nextLanguage)
                  setMessages([
                    {
                      role: 'assistant',
                      content: nextCopy[role === 'teacher' ? 'introTeacher' : 'introStudent'],
                    },
                  ])
                  setInput('')
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {copy.suggestions[role].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => sendMessage(suggestion)}
              className="flex w-full items-center justify-between rounded-[1.25rem] border border-slate-200 px-4 py-3 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20"
            >
              <span>{suggestion}</span>
              <Sparkles size={15} className="text-blue-500" />
            </button>
          ))}
        </div>
      </div>

      <div className="card-panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">Chat Window</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">WhatsApp-style smart assistant for attendance questions.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
            <Bot size={14} />
            VisionOS assistant
          </div>
        </div>

        <div className="mt-5 flex h-[28rem] flex-col rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex-1 space-y-3 overflow-y-auto pr-2">
            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant'
              return (
                <div key={`${message.role}-${index}`} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm ${isAssistant ? 'bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'bg-blue-600 text-white'}`}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-80">
                      {isAssistant ? <Bot size={12} /> : <User size={12} />}
                      {isAssistant ? 'Assistant' : 'You'}
                    </div>
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                  </div>
                </div>
              )
            })}
            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-[1.5rem] bg-white px-4 py-3 text-sm shadow-sm dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <LoaderCircle size={15} className="animate-spin" />
                    {copy.thinking}
                    </div>
                  </div>
                </div>
            ) : null}
          </div>

          <div className="mt-4 flex gap-3">
            <input
              className="field w-full"
              placeholder={copy.placeholder}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  sendMessage()
                }
              }}
            />
            <button type="button" onClick={() => sendMessage()} className="action-primary shrink-0" disabled={loading}>
              <Send size={16} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
