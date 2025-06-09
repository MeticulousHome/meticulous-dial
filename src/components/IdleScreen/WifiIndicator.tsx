export const WifiIndicator = ({
  enabled,
  style
}: {
  enabled: boolean;
  style: object;
}) => {
  return (
    <div style={style}>
      <svg
        width={30}
        height={23}
        viewBox="0 0 30 23"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g opacity={0.4}>
          {enabled && (
            <path
              d="M28.8947 7.55577L27.6295 6.37278C24.2337 3.1974 19.7581 1.43091 15.1089 1.43091C10.4598 1.43091 5.98424 3.1974 2.58838 6.37278L1.32324 7.55577"
              stroke="#E6E6E6"
              strokeWidth={1.5}
              strokeLinecap="square"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M23.8565 12.5252L22.5619 11.3746C20.5086 9.54948 17.8569 8.54136 15.1098 8.54136C12.3626 8.54136 9.71097 9.54948 7.65768 11.3746L6.36309 12.5252"
            stroke="#E6E6E6"
            strokeWidth={1.5}
            strokeLinecap="square"
            strokeLinejoin="round"
          />
          <circle
            cx={3.42834}
            cy={3.42834}
            r={3.42834}
            transform="matrix(1 0 0 -1 11.6816 22.4434)"
            fill="#E6E6E6"
          />
          {!enabled && (
            <path
              d="M4.0 22.0L26.0 1.0"
              stroke="#E6E6E6"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
};
