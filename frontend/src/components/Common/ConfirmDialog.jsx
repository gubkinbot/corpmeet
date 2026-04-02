import { motion, AnimatePresence } from "framer-motion";

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = "Удалить", danger = true }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 340 }}
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "var(--modal)", border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>{title}</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={onCancel}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                Отмена
              </button>
              <button onClick={onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: danger ? "linear-gradient(135deg, #dc2626, #ef4444)" : "linear-gradient(135deg, #4f46e5, #2563eb)" }}>
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
