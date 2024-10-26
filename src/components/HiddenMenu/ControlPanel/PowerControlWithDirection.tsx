interface PowerControlProps {
  label: string;
  value: number;
  isSelected: boolean;
  isEditing: boolean;
  isMotor?: boolean;
  isDirectionSelected?: boolean;
  mode?: 'up' | 'down' | 'loop';
  onDirectionSelect?: () => void;
}

const ArrowUp = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const ArrowDown = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 5v14m7-7l-7 7-7-7" />
  </svg>
);

const LoopIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      d="M24 8V2l-8 8 8 8v-6c6.63 0 12 5.37 12 12 0 2.03-.51 3.93-1.39 5.61l2.92 2.92C39.08 30.05 40 27.14 40 24c0-8.84-7.16-16-16-16zm0 28c-6.63 0-12-5.37-12-12 0-2.03.51-3.93 1.39-5.61l-2.92-2.92C8.92 17.95 8 20.86 8 24c0 8.84 7.16 16 16 16v6l8-8-8-8v6z"
      fill="currentColor"
    />
  </svg>
);

export function PowerControlWithDirection({
  label,
  value,
  isSelected,
  isEditing,
  isMotor = false,
  isDirectionSelected = false,
  mode = 'up',
  onDirectionSelect
}: PowerControlProps) {
  return (
    <div className="power-control">
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isMotor && (
          <div
            onClick={onDirectionSelect}
            style={{
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: isDirectionSelected ? '#ffe4a3' : '#f5c444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              border: isDirectionSelected
                ? '2px solid #ffffff'
                : '1px solid #ffffff'
            }}
          >
            {mode === 'up' ? (
              <ArrowUp />
            ) : mode === 'down' ? (
              <ArrowDown />
            ) : (
              <LoopIcon />
            )}
          </div>
        )}
        <input
          type="text"
          className={`power-input ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
          value={Math.abs(value)}
          readOnly
        />
      </div>
    </div>
  );
}
