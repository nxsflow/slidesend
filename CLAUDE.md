# Steering for Claude Code

This project receives its agent steering via the `SessionStart` hook which calls `nxf prime`, `nxc prime`, and `nxm prime` (depending on the modules activated). This tells the project about the open tasks, how to engage agents, as well as rules and memory of this project.
