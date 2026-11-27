#!/usr/bin/env node
// Entry point for the markflow command.
import { runInit } from "./init.js";

runInit(process.argv.slice(2));
