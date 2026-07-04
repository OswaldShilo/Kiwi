import React, { useState, useCallback, useEffect } from 'react'
import { render, Box, Text, useInput, useApp } from '@claude-code-kit/ink-renderer'
import { REPL, WelcomeScreen } from '@claude-code-kit/ui'
import axios from 'axios'

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const BACKEND_URL = 'http://127.0.0.1:8000'

function KiwiLogo({ color = "#84cc16" }: { color?: string }): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text color={color}>{"   ▄██████▄  "}</Text>
      <Text color={color}>{"  ██████████ "}</Text>
      <Text color={color}>{"  ██●████●██ "}</Text>
      <Text color={color}>{"  ▀████████▀ "}</Text>
      <Text color={color}>{"    █    █   "}</Text>
    </Box>
  );
}

type LoginState = {
  step: 'idle' | 'base_url' | 'api_key' | 'tenant_id' | 'llm_provider' | 'llm_model';
  baseUrl?: string;
  apiKey?: string;
  tenantId?: string;
  llmProvider?: string;
  llmModel?: string;
}

function App() {
  const { exit } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginState, setLoginState] = useState<LoginState>({ step: 'idle' })
  const [envCredentials, setEnvCredentials] = useState<{ baseUrl: string, apiKey: string, tenantId: string } | null>(null)
  const ctrlCPressedRef = React.useRef(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        const resp = await axios.get(`${BACKEND_URL}/kiwi/auth-status`)
        if (resp.data.has_env_credentials) {
          setEnvCredentials({
            baseUrl: resp.data.base_url,
            apiKey: resp.data.api_key,
            tenantId: resp.data.tenant_id
          })
        }
        if (resp.data.is_logged_in) {
          setIsLoggedIn(true)
          setLoginState({
            step: 'idle',
            baseUrl: resp.data.base_url,
            apiKey: resp.data.api_key,
            tenantId: resp.data.tenant_id,
            llmProvider: resp.data.llm_provider,
            llmModel: resp.data.llm_model
          })
        }
      } catch (e) {
        // ignore
      }
    }
    checkAuth()
  }, [])

  useInput((input, key) => {
    if (key.escape) {
      if (loginState.step !== 'idle') {
        setLoginState({ step: 'idle' })
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: 'Interactive configuration cancelled. Returned to main command line.'
        }])
        setIsLoading(false)
      }
    }

    if (key.ctrl && input === 'c') {
      if (ctrlCPressedRef.current) {
        exit()
      } else {
        ctrlCPressedRef.current = true
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: 'Press Ctrl+C again to close the session.'
        }])
        setTimeout(() => {
          ctrlCPressedRef.current = false
        }, 3000)
      }
    } else {
      ctrlCPressedRef.current = false
    }
  })

  const handleSubmit = useCallback(async (text: string, silent: boolean = false) => {
    setIsLoading(true)
    const userMsgId = Math.random().toString(36).substring(7)
    const userMsg: Message = { id: userMsgId, role: 'user', content: text }
    if (!silent) {
      setMessages(prev => [...prev, userMsg])
    }

    const assistantMsgId = Math.random().toString(36).substring(7)

    // Check login state steps
    if (loginState.step !== 'idle') {
      try {
        if (loginState.step === 'base_url') {
          setLoginState(prev => ({ ...prev, step: 'api_key', baseUrl: text }))
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Enter Cognee API Key:' }])
        } else if (loginState.step === 'api_key') {
          setLoginState(prev => ({ ...prev, step: 'tenant_id', apiKey: text }))
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Enter Tenant ID:' }])
        } else if (loginState.step === 'tenant_id') {
          setLoginState(prev => ({ ...prev, step: 'llm_provider', tenantId: text }))
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Choose LLM Provider:\n1. Anthropic\n2. OpenAI\n3. Gemini\nEnter number (1-3):' }])
        } else if (loginState.step === 'llm_provider') {
          const val = text.trim().toLowerCase()
          let provider = ''
          if (val === '1' || val === 'anthropic') {
            provider = 'Anthropic'
          } else if (val === '2' || val === 'openai') {
            provider = 'OpenAI'
          } else if (val === '3' || val === 'gemini') {
            provider = 'Gemini'
          }

          if (!provider) {
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Invalid choice. Please choose LLM Provider:\n1. Anthropic\n2. OpenAI\n3. Gemini\nEnter number (1-3):' }])
          } else {
            setLoginState(prev => ({ ...prev, step: 'llm_model', llmProvider: provider }))
            if (provider === 'Anthropic') {
              setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Choose Anthropic model:\n1. claude-fable-5\n2. claude-opus-4-8\n3. claude-sonnet-5\n4. claude-haiku-4-5-20251001\nEnter number (1-4):' }])
            } else if (provider === 'Gemini') {
              setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Choose Gemini model:\n1. gemini-3.5-flash\n2. gemini-3.1-flash-lite\n3. gemini-3.1-pro-preview\n4. gemini-3-flash-preview\nEnter number (1-4):' }])
            } else if (provider === 'OpenAI') {
              setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Choose OpenAI model:\n1. gpt-5.5-pro-2026-04-23\n2. gpt-5.5\n3. gpt-5.4-pro-2026-03-05\n4. gpt-5.4\n5. gpt-5.4-mini\nEnter number (1-5):' }])
            }
          }
        } else if (loginState.step === 'llm_model') {
          const val = text.trim().toLowerCase()
          let model = ''
          if (loginState.llmProvider === 'Anthropic') {
            if (val === '1' || val === 'claude-fable-5') model = 'claude-fable-5'
            else if (val === '2' || val === 'claude-opus-4-8') model = 'claude-opus-4-8'
            else if (val === '3' || val === 'claude-sonnet-5') model = 'claude-sonnet-5'
            else if (val === '4' || val === 'claude-haiku-4-5-20251001') model = 'claude-haiku-4-5-20251001'
          } else if (loginState.llmProvider === 'Gemini') {
            if (val === '1' || val === 'gemini-3.5-flash') model = 'gemini-3.5-flash'
            else if (val === '2' || val === 'gemini-3.1-flash-lite') model = 'gemini-3.1-flash-lite'
            else if (val === '3' || val === 'gemini-3.1-pro-preview') model = 'gemini-3.1-pro-preview'
            else if (val === '4' || val === 'gemini-3-flash-preview') model = 'gemini-3-flash-preview'
          } else if (loginState.llmProvider === 'OpenAI') {
            if (val === '1' || val === 'gpt-5.5-pro-2026-04-23') model = 'gpt-5.5-pro-2026-04-23'
            else if (val === '2' || val === 'gpt-5.5') model = 'gpt-5.5'
            else if (val === '3' || val === 'gpt-5.4-pro-2026-03-05') model = 'gpt-5.4-pro-2026-03-05'
            else if (val === '4' || val === 'gpt-5.4') model = 'gpt-5.4'
            else if (val === '5' || val === 'gpt-5.4-mini') model = 'gpt-5.4-mini'
          }

          if (!model) {
            let optionsStr = ''
            if (loginState.llmProvider === 'Anthropic') {
              optionsStr = 'Choose Anthropic model:\n1. claude-fable-5\n2. claude-opus-4-8\n3. claude-sonnet-5\n4. claude-haiku-4-5-20251001\nEnter number (1-4):'
            } else if (loginState.llmProvider === 'Gemini') {
              optionsStr = 'Choose Gemini model:\n1. gemini-3.5-flash\n2. gemini-3.1-flash-lite\n3. gemini-3.1-pro-preview\n4. gemini-3-flash-preview\nEnter number (1-4):'
            } else if (loginState.llmProvider === 'OpenAI') {
              optionsStr = 'Choose OpenAI model:\n1. gpt-5.5-pro-2026-04-23\n2. gpt-5.5\n3. gpt-5.4-pro-2026-03-05\n4. gpt-5.4\n5. gpt-5.4-mini\nEnter number (1-5):'
            }
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Invalid choice. ' + optionsStr }])
          } else {
            const nextState = { ...loginState, step: 'idle' as const, llmModel: model }
            setLoginState(nextState)
            
            // Post to backend to save auth status persistently
            await axios.post(`${BACKEND_URL}/kiwi/login`, {
              base_url: nextState.baseUrl || '',
              api_key: nextState.apiKey || '',
              tenant_id: nextState.tenantId || '',
              llm_provider: nextState.llmProvider || '',
              llm_model: model
            })

            setIsLoggedIn(true)
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Login successful! Active session initialized with provider: ${nextState.llmProvider} (${model}).` }])
          }
        }
      } finally {
        setIsLoading(false)
      }
      return
    }

    const isLoginCmd = text.startsWith('/login')
    const isHelpCmd = text.startsWith('/help')
    const isExitCmd = text.startsWith('/exit')

    if (!isLoggedIn && !isLoginCmd && !isHelpCmd && !isExitCmd) {
      setIsLoading(false)
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Error: Please login with credential first. Run `/login` to authenticate.' }])
      return
    }

    try {
      if (text.startsWith('/remember')) {
        const fact = text.substring(9).trim()
        if (!fact) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Please provide a fact to remember.' }])
        } else {
          await axios.post(`${BACKEND_URL}/kiwi/remember`, { text: fact })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Stored in memory: "${fact}"` }])
        }
      } else if (text.startsWith('/recall')) {
        const query = text.substring(7).trim()
        if (!query) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Please provide a query to recall.' }])
        } else {
          const resp = await axios.post(`${BACKEND_URL}/kiwi/recall`, { query })
          const hits = resp.data.hits || []
          if (hits.length > 0) {
            const hitsText = hits.map((h: any, i: number) => `[${i + 1}] ${h.text}`).join('\n\n')
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Matching memories:\n\n${hitsText}` }])
          } else {
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'No matching memories found.' }])
          }
        }
      } else if (text.startsWith('/forget')) {
        const args = text.substring(7).trim()
        if (!args) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Error: /forget requires either --all or a specific dataset name. Example: `/forget --all` or `/forget sentinel`.' }])
        } else if (args === '--all') {
          await axios.post(`${BACKEND_URL}/kiwi/forget`, { all: true })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'All memory datasets cleared.' }])
        } else {
          await axios.post(`${BACKEND_URL}/kiwi/forget`, { dataset: args })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Dataset memory cleared for "${args}".` }])
        }
      } else if (text.startsWith('/test')) {
        const testPath = text.substring(5).trim()
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: testPath ? `Running test suite (pytest) on "${testPath}"...` : 'Running test suite (pytest)...' }])
        const resp = await axios.post(`${BACKEND_URL}/kiwi/test`, { path: testPath })
        const output = resp.data.output || ''
        const reviews = resp.data.reviews || []
        let content = `Test execution complete.\n\n${output}`
        if (reviews.length > 0) {
          content += `\n\n### Reviews:\n` + reviews.join('\n\n')
        }
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content }])
      } else if (text.startsWith('/resolve')) {
        const summary = text.substring(8).trim()
        if (!summary) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Error: /resolve requires a summary description. Example: `/resolve fixed the API mock response`.' }])
        } else {
          const resp = await axios.post(`${BACKEND_URL}/kiwi/resolve`, { summary })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Stored resolution for "${resp.data.test_name}": ${summary}` }])
        }
      } else if (text.startsWith('/flaky')) {
        const testName = text.substring(6).trim()
        const resp = await axios.post(`${BACKEND_URL}/kiwi/flaky`, { test_name: testName })
        if (testName) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Test "${testName}" has failed ${resp.data.count} times locally.` }])
        } else {
          const list = Object.entries(resp.data.flaky_tests || {})
            .map(([name, cnt]) => `- ${name}: ${cnt} failures`)
            .join('\n')
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: list ? `Flaky tests (occurrence tracking):\n\n${list}` : 'No flaky tests tracked yet.' }])
        }
      } else if (text.startsWith('/history')) {
        const testName = text.substring(8).trim()
        if (!testName) {
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Error: /history requires a test name.' }])
        } else {
          const resp = await axios.post(`${BACKEND_URL}/kiwi/recall`, { query: testName })
          const hits = resp.data.hits || []
          if (hits.length > 0) {
            const hitsText = hits.map((h: any, i: number) => `[${i + 1}] ${h.text}`).join('\n\n')
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `History timeline for "${testName}":\n\n${hitsText}` }])
          } else {
            setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `No history records found for test "${testName}".` }])
          }
        }
      } else if (text.startsWith('/session')) {
        const resp = await axios.post(`${BACKEND_URL}/kiwi/session`)
        const log = resp.data.session_log || []
        const logText = log.map((entry: string, i: number) => `[${i + 1}] ${entry}`).join('\n')
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: logText ? `Active Session Log:\n\n${logText}` : 'Active session log is empty.' }])
      } else if (text.startsWith('/provider')) {
        setLoginState(prev => ({ ...prev, step: 'llm_provider' }))
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Choose LLM Provider:\n1. Anthropic\n2. OpenAI\n3. Gemini\nEnter number (1-3):' }])
      } else if (text.startsWith('/model')) {
        setLoginState(prev => ({ ...prev, step: 'llm_model' }))
        let content = ''
        if (loginState.llmProvider === 'Anthropic') {
          content = 'Choose Anthropic model:\n1. claude-fable-5\n2. claude-opus-4-8\n3. claude-sonnet-5\n4. claude-haiku-4-5-20251001\nEnter number (1-4):'
        } else if (loginState.llmProvider === 'Gemini') {
          content = 'Choose Gemini model:\n1. gemini-3.5-flash\n2. gemini-3.1-flash-lite\n3. gemini-3.1-pro-preview\n4. gemini-3-flash-preview\nEnter number (1-4):'
        } else if (loginState.llmProvider === 'OpenAI') {
          content = 'Choose OpenAI model:\n1. gpt-5.5-pro-2026-04-23\n2. gpt-5.5\n3. gpt-5.4-pro-2026-03-05\n4. gpt-5.4\n5. gpt-5.4-mini\nEnter number (1-5):'
        } else {
          content = 'Error: No active LLM provider found. Please login first.'
          setLoginState(prev => ({ ...prev, step: 'idle' }))
        }
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content }])
      } else if (text.startsWith('/config')) {
        const configDetails = [
          'Active Configuration:',
          `  - Cognee Base URL: ${loginState.baseUrl || 'Not configured'}`,
          `  - Tenant ID:       ${loginState.tenantId || 'Not configured'}`,
          `  - LLM Provider:    ${loginState.llmProvider || 'Not configured'}`,
          `  - LLM Model:       ${loginState.llmModel || 'Not configured'}`
        ].join('\n')
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: configDetails }])
      } else if (text.startsWith('/clear')) {
        setMessages([])
      } else if (text.startsWith('/login')) {
        if (envCredentials) {
          setLoginState({
            step: 'llm_provider',
            baseUrl: envCredentials.baseUrl,
            apiKey: envCredentials.apiKey,
            tenantId: envCredentials.tenantId
          })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Cognee credentials detected from .env file!\nChoose LLM Provider:\n1. Anthropic\n2. OpenAI\n3. Gemini\nEnter number (1-3):' }])
        } else {
          setLoginState({ step: 'base_url' })
          setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Enter Cognee Base URL:' }])
        }
      } else if (text.startsWith('/exit')) {
        exit()
      } else if (text.startsWith('/help')) {
        const helpText = [
          'Available Commands:',
          '  /login                  Login with credentials (interactive)',
          '  /provider               Switch active LLM provider',
          '  /model                  Switch active LLM model',
          '  /config                 Show current configuration and settings',
          '  /clear                  Clear conversation screen history',
          '  /test [path]            Run pytest and auto-ingest failure memory',
          '  /remember <text>        Store manual context/incident details',
          '  /recall <query>         Query memory for similar past issues',
          '  /resolve <summary>      Log the fix for the last failing test in context',
          '  /flaky [test_name]      Show flaky tests counts or target test history',
          '  /history <test_name>    List all failure timeline logs for a specific test',
          '  /session                Show loaded memory interactions from this session',
          '  /forget [--all|dataset] Wipe Cognee datasets explicitly',
          '  /exit                   Exit the Kiwi session (Ctrl+C is disabled)',
          '  /help                   Show this help message'
        ].join('\n')
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: helpText }])
      } else if (text.startsWith('/review')) {
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: 'Use /test to run the tests and generate a review, or review a test directly.' }])
      } else {
        // Initialize an assistant message with a thinking block
        const assistantMsg: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'Initializing...', collapsed: false }
          ]
        }
        setMessages(prev => [...prev, assistantMsg])

        const response = await fetch(`${BACKEND_URL}/kiwi/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''
        let actionPayload: any = null
        
        if (reader) {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const parsed = JSON.parse(line)
                if (parsed.type === 'thinking') {
                  setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                      const contents = [...(Array.isArray(m.content) ? m.content : [])]
                      const thinkIdx = contents.findIndex(c => c.type === 'thinking')
                      if (thinkIdx >= 0) {
                        contents[thinkIdx] = { type: 'thinking', text: parsed.text, collapsed: false }
                      } else {
                        contents.unshift({ type: 'thinking', text: parsed.text, collapsed: false })
                      }
                      return { ...m, content: contents }
                    }
                    return m
                  }))
                } else if (parsed.type === 'chunk' || parsed.type === 'text') {
                  accumulatedText += parsed.text
                  setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                      const contents = [...(Array.isArray(m.content) ? m.content : [])]
                      
                      const thinkIdx = contents.findIndex(c => c.type === 'thinking')
                      if (thinkIdx >= 0) {
                        contents[thinkIdx] = { ...contents[thinkIdx], collapsed: true }
                      }
                      
                      const textIdx = contents.findIndex(c => c.type === 'text')
                      if (textIdx >= 0) {
                        contents[textIdx] = { type: 'text', text: accumulatedText }
                      } else {
                        contents.push({ type: 'text', text: accumulatedText })
                      }
                      return { ...m, content: contents }
                    }
                    return m
                  }))
                } else if (parsed.type === 'action') {
                  actionPayload = parsed
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message)
                }
              } catch (err) {
                // ignore split errors
              }
            }
          }
        }

        if (actionPayload) {
          // Collapse the thinking block so it stays visible on screen, but do not delete it
          setMessages(prev => prev.map(m => {
            if (m.id === assistantMsgId && Array.isArray(m.content)) {
              return {
                ...m,
                content: m.content.map(c => c.type === 'thinking' ? { ...c, collapsed: true } : c)
              }
            }
            return m
          }))
          
          const action = actionPayload.action
          const args = actionPayload.args || {}
          if (action === 'clear') {
            setMessages([])
            setIsLoading(false)
            return
          }
          if (action === 'exit') {
            exit()
            setIsLoading(false)
            return
          }
          
          let cmd = `/${action}`
          if (action === 'test' && args.path) {
            cmd += ` ${args.path}`
          } else if (action === 'remember' && args.text) {
            cmd += ` ${args.text}`
          } else if (action === 'recall' && args.query) {
            cmd += ` ${args.query}`
          } else if (action === 'forget') {
            cmd += ` ${args.all ? '--all' : (args.dataset || '')}`
          } else if (action === 'resolve' && args.summary) {
            cmd += ` ${args.summary}`
          } else if (action === 'flaky' && args.test_name) {
            cmd += ` ${args.test_name}`
          } else if (action === 'history' && args.test_name) {
            cmd += ` ${args.test_name}`
          }
          
          await handleSubmit(cmd, true)
        }
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: `Error communicating with Kiwi backend: ${errMsg}` }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoggedIn, loginState, envCredentials])

  const customRenderMessage = useCallback((message: any) => {
    const isUser = message.role === "user";
    const icon = isUser ? "\u276F" : "\u25CF";
    const label = isUser ? "You" : "Kiwi";
    const color = isUser ? "cyan" : "#84cc16"; // beautiful lime/green for Kiwi

    const renderContent = () => {
      if (typeof message.content === 'string') {
        return <Text>{message.content}</Text>;
      }
      return (
        <Box flexDirection="column">
          {message.content.map((c: any, i: number) => {
            if (c.type === 'thinking') {
              return (
                <Box key={i} flexDirection="column" marginY={1}>
                  <Box
                    onClick={() => {
                      setMessages(prev => prev.map(m => {
                        if (m.id === message.id && Array.isArray(m.content)) {
                          const contents = m.content.map(item => {
                            if (item.type === 'thinking') {
                              return { ...item, collapsed: !item.collapsed }
                            }
                            return item;
                          });
                          return { ...m, content: contents }
                        }
                        return m;
                      }))
                    }}
                  >
                    <Text dimColor>
                      {c.collapsed ? '▶ Thinking (click to expand)' : '▼ Thinking'}
                    </Text>
                  </Box>
                  {!c.collapsed && (
                    <Box marginLeft={2} paddingLeft={1} borderStyle="round" borderColor="gray">
                      <Text italic dimColor>{c.text}</Text>
                    </Box>
                  )}
                </Box>
              );
            }
            if (c.type === 'text') {
              return <Text key={i}>{c.text}</Text>;
            }
            return null;
          })}
        </Box>
      );
    };

    return (
      <Box flexDirection="column" key={message.id}>
        <Box>
          <Text color={color}>{icon}</Text>
          <Text color={color} bold>
            {" "}
            {label}
          </Text>
        </Box>
        <Box marginLeft={2}>
          {renderContent()}
        </Box>
      </Box>
    );
  }, []);

  return (
    <REPL
      messages={messages}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      model="kiwi:cognee-memory"
      placeholder="Ask Kiwi about your tests or codebase..."
      renderMessage={customRenderMessage}
      welcome={
        <Box flexDirection="column">
          <WelcomeScreen
            appName="Kiwi"
            subtitle="QA Harness Agent"
            logo={<KiwiLogo />}
          />
          <Box marginTop={1} marginLeft={1}>
            <Text dimColor>Type /help to list all available commands</Text>
          </Box>
        </Box>
      }
      commands={loginState.step !== 'idle' ? [] : [
        { name: 'login', description: 'Login with credentials (interactive)', onExecute: () => handleSubmit('/login') },
        { name: 'provider', description: 'Switch active LLM provider', onExecute: () => handleSubmit('/provider') },
        { name: 'model', description: 'Switch active LLM model', onExecute: () => handleSubmit('/model') },
        { name: 'config', description: 'Show active configuration and settings', onExecute: () => handleSubmit('/config') },
        { name: 'clear', description: 'Clear screen history', onExecute: () => handleSubmit('/clear') },
        { name: 'test', description: 'Run pytest and auto-ingest failures', onExecute: () => handleSubmit('/test') },
        { name: 'forget', description: 'Clear active memory dataset', onExecute: () => handleSubmit('/forget') },
        { name: 'resolve', description: 'Log a fix/resolution for the active failure', onExecute: () => handleSubmit('/resolve') },
        { name: 'flaky', description: 'Show flaky test metrics', onExecute: () => handleSubmit('/flaky') },
        { name: 'history', description: 'Show history for a specific test', onExecute: () => handleSubmit('/history') },
        { name: 'session', description: 'Show current session logs', onExecute: () => handleSubmit('/session') },
        { name: 'exit', description: 'Exit the Kiwi CLI session', onExecute: () => handleSubmit('/exit') },
        { name: 'help', description: 'List available commands', onExecute: () => handleSubmit('/help') }
      ]}
    />
  )
}

await render(<App />, { exitOnCtrlC: false })
