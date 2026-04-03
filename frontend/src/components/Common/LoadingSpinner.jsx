import { motion } from "framer-motion";

export default function LoadingSpinner({ size = 32 }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        border: "2px solid rgba(37,99,235,0.3)",
        borderTopColor: "rgba(37,99,235,0.8)",
      }}
    />
  );
}
