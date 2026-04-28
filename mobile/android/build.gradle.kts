allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val tempBuildDir = file("${System.getProperty("java.io.tmpdir")}/mobile_flutter_build")
val newBuildDir: Directory = rootProject.layout.projectDirectory.dir(tempBuildDir.absolutePath)
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
