[CmdletBinding(DefaultParameterSetName = 'None')]
param(
    [string]
	$project,

    [Parameter(Mandatory=$true)]
	[ValidateNotNullOrEmpty()]
	[string]
	$buildDefinitionId,

    [Parameter(Mandatory=$true)]
	[ValidateNotNullOrEmpty()]
	[string]
	$artifactName,

	[string]
	$targetDirectory
)

# Validate project
if ([string]::IsNullOrEmpty($project)) {
	$project = $Env:SYSTEM_TEAMPROJECT
}

# Validate build definition id
[int]$definitionId = 0
if (!([int]::TryParse($buildDefinitionId, [ref]$definitionId))) {
	throw "Build Definition Id is not a valid numerical value"
}

if ($definitionId -eq 0) {
	throw "Build Definition Id cannot be 0 (zero)"
}

# Validate target directory
if ([string]::IsNullOrEmpty($targetDirectory)) {
	$targetDirectory = $Env:BUILD_SOURCESDIRECTORY
}

if (!(Test-Path $targetDirectory -PathType Container)) {
	throw "Invalid Target Directory. The path is not a directory or does not exist."
}

$projectUri = $Env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI + $project

Write-Output "Project`t`t`t: $project"
Write-Output "Project Uri`t`t: $projectUri"
Write-Output "Build Definition Id`t: $definitionId"
Write-Output "Build Artifact Name`t: $artifactName"
Write-Output "Target Directory`t: $targetDirectory"

# Requires "Allow Scripts to Access OAuth Token" enabled on the build defintion.
$authHeader = @{
    Authorization = "Bearer $Env:SYSTEM_ACCESSTOKEN"
}

$buildUri = $projectUri + '/_apis/build/builds?definitions=' + $definitionId + '&statusFilter=completed&resultFilter=succeeded&$top=1&api-version=2.0'

Write-Output "Querying completed successful builds of build definition `"$definitionId`""

$buildId = ""
try {
	$response = Invoke-RestMethod -Uri $buildUri -Method GET -Headers $authHeader
	$buildId = $response.value.id
} catch { 
	throw "Could not find project `"$project`""
}

if ([string]::IsNullOrEmpty($buildId)) {
	throw "Could not find a completed successful build. Ensure that build definition `"$definitionId`" has a successful build."
} else {
	Write-Output "Found build `"$buildId`""
}

$buildArtifactUri = $projectUri + '/_apis/build/builds/' + $buildId + '/artifacts?api-version=2.0'

Write-Output "Querying build artifact `"$artifactName`""

$artifactUri = ""
try {
	$response = Invoke-RestMethod -Uri $buildArtifactUri -Method GET -Headers $authHeader
	$artifactUri = $response.value.Where({$_.name -eq $artifactName}).resource.downloadUrl
} catch {
	throw "Could not find build `"$buildId`""
}

if ([string]::IsNullOrEmpty($artifactUri)) {
	throw "Could not find build artifact `"$artifactName`""
} else {
	Write-Output "Found build artifact `"$artifactName`""
}

$artifactPath = Join-path $targetDirectory ($artifactName + ".zip")

Write-Output "Downloading build artifact `"$artifactName`" to $artifactPath"

try {
	Invoke-WebRequest -Uri $artifactUri -OutFile $artifactPath -Headers $authHeader
} catch {
	throw "Could not download build artifact from $artifactUri"
}

Write-Output "Extracting $artifactPath to $targetDirectory\$artifactName"

if ($Host.Version.Major -eq 5) {
	Import-Module Microsoft.PowerShell.Archive
	Expand-Archive -Path $artifactPath -DestinationPath $targetDirectory
} else {
	Add-Type -AssemblyName System.IO.Compression.FileSystem
	[System.IO.Compression.ZipFile]::ExtractToDirectory($artifactPath, $targetDirectory)
}

Write-Output "Items included in build artifact:"
Get-ChildItem -Path "$targetDirectory\$artifactName"