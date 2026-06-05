import { motion } from 'framer-motion';

interface Props {
  size?: number;
  showLabel?: boolean;
}

export function LogoMark({ size = 80, showLabel }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      <img
        src="/logo.png"
        alt="1216"
        width={size}
        height={size}
        style={{
          borderRadius: size * 0.28,
          border: '2px solid var(--primary)',
          boxShadow: '0 4px 24px rgba(255,77,109,0.4)',
          objectFit: 'cover',
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>1216</span>
      )}
    </motion.div>
  );
}
