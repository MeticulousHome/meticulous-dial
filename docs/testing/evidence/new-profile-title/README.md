# New-profile title validation

480 × 480 Chromium captures of the actual Dial navigation, profile context and editor components, using a synthetic TURBO catalog profile and simulated API/socket transports. No machine was contacted.

- `before.png`: beta `e5b54da1`, create from the catalog's New action; TURBO appears above Name: New Profile.
- `after.png`: the same creation sequence and fixture with this change; the unrelated title pill is absent.
- `existing-edit.png`: after creating and saving a new profile, open TURBO through Quick Settings → Edit profile; its title remains visible.

The browser check also exercised the new profile's Name, Temperature and Output screens, adjusted numeric values, checked the simulated save payload (same generated ID, name and edited values), and discarded an existing edit without an additional save. Profile-name input was seeded through the fixture; physical keyboard, firmware and machine persistence were not tested.
