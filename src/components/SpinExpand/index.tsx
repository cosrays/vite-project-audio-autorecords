import styles from './index.module.less';

export default function SpinExpand({ children, className }: { children: React.ReactNode, className?: string | string[] }) {
  return <div className={`${styles.wrapper} ${className}`} >
    <div className={styles.onLNDc} />
    <div className={styles.LmmD9} />
    <div className={styles.d4HWzd} />
    {children}
  </div>;
}