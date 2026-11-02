$ProgressPreference = 'SilentlyContinue'
Compress-Archive -Path "D:\ZK Software\Dev\zkcommerce\zkcommerce-v4.1.0-source\zkc\deployment\smeram-godaddy\*" -DestinationPath "D:\ZK Software\Dev\zkcommerce\zkcommerce-v4.1.0-source\zkc\deployment\smeram-godaddy-deploy-v1.0.14.zip" -Force
Write-Host "Done"
