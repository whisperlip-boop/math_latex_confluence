#!/usr/bin/env bash
# Build the app and drop the JAR where the Windows-side browser can reach it for
# "Manage apps -> Upload app".
set -euo pipefail
cd "$(dirname "$0")"

export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
/opt/atlassian-plugin-sdk/bin/atlas-mvn -B clean package "$@"

JAR=$(ls target/*.jar)
DROP=${DROP:-/mnt/c/Users/$USER/Downloads}
if [ -d "$DROP" ]; then
    cp "$JAR" "$DROP/"
    echo "copied to $DROP/$(basename "$JAR")"
fi
echo "$JAR"
