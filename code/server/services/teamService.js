import Team from "../models/Team.js";
import Project from "../models/Project.js";
import TeamRequest from "../models/TeamRequest.js";

export async function createTeam({name,projectId,userId}) {
  const project=await Project.findById(projectId);
  if(!project) throw new Error("Project not found");
  const team=await Team.create({name,project:projectId,owner:userId,members:[userId]});
  if(!project.members.some(id=>id.toString()===userId.toString())) project.members.push(userId);
  await project.save();
  return team.populate(["project","owner","members"]);
}
export async function myTeams(userId) {
  return Team.find({members:userId}).populate("project","title").populate("owner","name").populate("members","name email");
}
export async function getTeam(id) {
  const team=await Team.findById(id).populate("project","title teamSize").populate("owner","name email").populate("members","name email");
  const requests=await TeamRequest.find({team:id,status:"pending"}).populate("user","name email");
  return {team,requests};
}
