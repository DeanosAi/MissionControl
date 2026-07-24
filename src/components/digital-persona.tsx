import styles from './digital-persona.module.css';

export type DigitalPersonaState =
  | 'greeting'
  | 'thinking'
  | 'listening'
  | 'celebrating'
  | 'warning'
  | 'waiting';

export function DigitalPersona({
  state,
  size = 'small',
  label,
}: {
  state: DigitalPersonaState;
  size?: 'small' | 'medium' | 'large';
  label?: string;
}) {
  return (
    <div className={`${styles.persona} ${styles[`state_${state}`]} ${styles[`size_${size}`]}`}>
      <span className={styles.visual} aria-hidden="true">
        <i className={styles.haloOuter} />
        <i className={styles.haloInner} />
        <i className={styles.core}>MC</i>
      </span>
      {label ? (
        <span className={styles.copy}>
          <strong>{label}</strong>
          <small>{state}</small>
        </span>
      ) : (
        <span className={styles.srOnly}>Mission Control is {state}</span>
      )}
    </div>
  );
}

