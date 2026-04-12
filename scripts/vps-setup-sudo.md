# VPS Setup for Passwordless Usage Updates

This configures the VPS to allow the usage snapshot script to run via sudo without compromising security.

## On the VPS, run as deanadmin:

### 1. Make the script executable
```bash
cd ~/apps/mission-control-vps
chmod +x scripts/vps-insert-usage-snapshot.sh
```

### 2. Create a sudoers configuration (requires sudo password once)
```bash
sudo tee /etc/sudoers.d/mission-control-usage << 'EOF'
# Allow deanadmin to run the usage snapshot script without password
deanadmin ALL=(ALL) NOPASSWD: /home/deanadmin/apps/mission-control-vps/scripts/vps-insert-usage-snapshot.sh
EOF
```

### 3. Set correct permissions on the sudoers file
```bash
sudo chmod 0440 /etc/sudoers.d/mission-control-usage
```

### 4. Test it works
```bash
echo "SELECT 1;" | sudo ~/apps/mission-control-vps/scripts/vps-insert-usage-snapshot.sh
```

This should fail with "Only INSERT statements for usage_snapshots are allowed" (which is correct - the security check works!).

## Security notes

- Only the specific script can run without password
- The script validates that only INSERT statements for usage_snapshots are allowed
- No other sudo commands are affected
- Docker access remains restricted to authorized commands only
