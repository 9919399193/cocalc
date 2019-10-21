import { wrap } from "./course-panel-wrapper";

import { AssignmentsPanel } from "../../course/assignments_panel";
export const Assignments = wrap(AssignmentsPanel);

import { StudentsPanel } from "../../course/students_panel";
export const Students = wrap(StudentsPanel);

import { HandoutsPanel } from "../../course/handouts_panel";
export const Handouts = wrap(HandoutsPanel);

import { ConfigurationPanel } from "../../course/configuration_panel";
export const Configuration = wrap(ConfigurationPanel);

import { SharedProjectPanel } from "../../course/shared_project_panel";
export const SharedProject = wrap(SharedProjectPanel);
