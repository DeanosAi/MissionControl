# Start SSH agent and add your key (you'll need to enter your passphrase once)
# After running this, the passphrase will be cached for the duration of your Windows session

$ErrorActionPreference = 'Stop'

Write-Host "Starting SSH agent..." -ForegroundColor Cyan

# Start ssh-agent if not already running
$sshAgent = Get-Service ssh-agent -ErrorAction SilentlyContinue
if ($sshAgent.Status -ne 'Running') {
    Write-Host "Starting ssh-agent service..." -ForegroundColor Yellow
    Start-Service ssh-agent
    Set-Service -Name ssh-agent -StartupType Automatic
    Write-Host "SSH agent service started" -ForegroundColor Green
} else {
    Write-Host "SSH agent is already running" -ForegroundColor Green
}

# Add your SSH key
Write-Host "`nAdding SSH key (you will be prompted for your passphrase)..." -ForegroundColor Cyan
ssh-add "$env:USERPROFILE\.ssh\id_ed25519"

Write-Host "`nSSH key added to agent" -ForegroundColor Green
Write-Host "`nYour passphrase is now cached. The update script will run without prompting." -ForegroundColor Green
Write-Host "You can now run the update script" -ForegroundColor Cyan
