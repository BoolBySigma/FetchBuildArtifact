# Fetch Build Artifacts
Fetch build artifacts from any project and build definition.

## Note
This task requires **Allow Scripts to Access OAuth Token** to be **enabled**.

## Usage
Add a new **Fetch Build Artifacts** task from the **Utility** category...

![Task](images/task.png)

...and configure it as needed.

![Parameters](images/screenshot.png)
Parameters include:
* **Project**: Project from where to fetch the build artifact. Leaving it blank defaults to the current project and is equal to using $(System.TeamProject).
* **Build Definition Id**: Id of build definition from where to fetch build artifact. Must be a valid numerical value, eg. 12, and an existing build definition.
* **Build Artifact Name**: Name of the artifact to fetch, eg. "drop".
* **Target Directory**: The directory where to download the artifact. Must be an existing directory. Leaving it blank defaults to source root directory and is equal to using $(Build.SourcesDirectory).


Icons made by [Freepik](http://www.freepik.com) from [Flaticon](http://www.flaticon.com) is licensed by [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/)
