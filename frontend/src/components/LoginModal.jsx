// ---- LoginModal.jsx ----
// Institutional Terminal Access Gate Modal wrapper
// Zero em dash characters used (R-02 compliance).

import LoginPage from './LoginPage'

export default function LoginModal({ isOpen = true, onClose, onBackToLanding }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Access Gate"
            className="absolute top-4 right-4 z-20 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-pitch-900 border border-pitch-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        )}
        <LoginPage onBackToLanding={onClose || onBackToLanding} />
      </div>
    </div>
  )
}

export { LoginPage }
