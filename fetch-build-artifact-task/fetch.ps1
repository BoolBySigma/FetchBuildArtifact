[CmdletBinding(DefaultParameterSetName = 'None')]
param()

Trace-VstsEnteringInvocation $MyInvocation

$project = Get-VstsInput -Name project -Default $Env:SYSTEM_TEAMPROJECT
$definitionId = Get-VstsInput -Name buildDefinition -Require -AsInt
$artifactName = Get-VstsInput -Name artifactName -Require
$targetDirectory = Get-VstsInput -Name targetDirectory -Default $Env:BUILD_SOURCESDIRECTORY

try {
	# Validate target directory
	if (!(Test-Path $targetDirectory -PathType Container)) {
		Write-VstsTaskError "Invalid Target Directory. The path is not a directory or does not exist."
	}

	$projectUri = $Env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI + $project

	# Print parameters
	$parameters = @()
	$parameters += New-Object PSObject -Property @{Parameter="Project Id"; Value=$project}
	$parameters += New-Object PSObject -Property @{Parameter="Project Uri"; Value=$projectUri}
	$parameters += New-Object PSObject -Property @{Parameter="Build Definition Id"; Value=$definitionId}
	$parameters += New-Object PSObject -Property @{Parameter="Build Artifact Name"; Value=$artifactName}
	$parameters += New-Object PSObject -Property @{Parameter="Target Directory"; Value=$targetDirectory}
	$parameters | Format-Table -Property Parameter, Value

	# Requires "Allow Scripts to Access OAuth Token" enabled on the build defintion.
	$authHeader = @{
		Authorization = "Bearer $Env:SYSTEM_ACCESSTOKEN"
	}

	$buildUri = $projectUri + '/_apis/build/builds?definitions=' + $definitionId + '&statusFilter=completed&resultFilter=succeeded&$top=1&api-version=2.0'

	Write-Output "Querying completed successful builds of build definition `'$definitionId`'"

	$buildId = ""
	try {
		$response = Invoke-RestMethod -Uri $buildUri -Method GET -Headers $authHeader
		$buildId = $response.value.id
	} catch { 
		Write-VstsTaskError "Could not find project `'$project`'. Make sure `'Allow Scripts to Access OAuth Token`' is enabled and that the project exists."
	}

	if ([string]::IsNullOrEmpty($buildId)) {
		Write-VstsTaskError "Could not find a completed successful build. Ensure that build definition `'$definitionId`' has a successful build."
	} else {
		Write-Output "Found build `'$buildId`'"
	}

	$buildArtifactUri = $projectUri + '/_apis/build/builds/' + $buildId + '/artifacts?api-version=2.0'

	Write-Output "Querying build artifact `'$artifactName`'"

	$artifactUri = ""
	try {
		$response = Invoke-RestMethod -Uri $buildArtifactUri -Method GET -Headers $authHeader
		$artifactUri = $response.value.Where({$_.name -eq $artifactName}).resource.downloadUrl
	} catch {
		Write-VstsTaskError "Could not find build `'$buildId`'"
	}

	if ([string]::IsNullOrEmpty($artifactUri)) {
		Write-VstsTaskError "Could not find build artifact `'$artifactName`'"
	} else {
		Write-Output "Found build artifact `'$artifactName`'"
	}

	$artifactPath = Join-path $targetDirectory ($artifactName + ".zip")

	Write-Output "Downloading build artifact `'$artifactName`' to $artifactPath"

	try {
		Invoke-WebRequest -Uri $artifactUri -OutFile $artifactPath -Headers $authHeader
	} catch {
		Write-VstsTaskError "Could not download build artifact from $artifactUri"
	}

	Write-Output "Extracting $artifactPath to $targetDirectory\$artifactName"

	if ($Host.Version.Major -eq 5) {
		Import-Module Microsoft.PowerShell.Archive
		Expand-Archive -Path $artifactPath -DestinationPath $targetDirectory
	} else {
		Add-Type -AssemblyName System.IO.Compression.FileSystem
		[System.IO.Compression.ZipFile]::ExtractToDirectory($artifactPath, $targetDirectory)
	}

	Get-ChildItem -Path "$targetDirectory\$artifactName"
} finally {
	Trace-VstsLeavingInvocation $MyInvocation
}