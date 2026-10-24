# The real services no development run or test may reach, sourced by run-dev.sh and dev-backend.sh: inside
# their containers these names resolve to 127.0.0.1, where nothing answers. The Dial's own guard
# (DIAL_EXTERNAL_SERVICES) already keeps it off them; this also covers the emulated backend, which has
# real Sentry DSNs, the production shot-sharing bucket and the time zone lookup built in.
real_service_hosts=(
    sentry.meticulousespresso.com                      # Sentry (Dial, backend, firmware projects)
    analytics.meticulousespresso.com                   # the backend's time zone by IP
    community.meticuloushome.com                       # Community (pairing codes, shot uploads)
    a3qhsgqqfk.execute-api.us-east-1.amazonaws.com     # support tickets
    szlveuxkohdjujuojwvf.supabase.co                   # shared brew shots
)
no_real_services=()
for h in "${real_service_hosts[@]}"; do no_real_services+=(--add-host "$h:127.0.0.1"); done
