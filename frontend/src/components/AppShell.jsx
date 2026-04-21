import TopNav from './TopNav'

export default function AppShell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', width: '100%', overflowX: 'clip' }}>
      <TopNav />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
