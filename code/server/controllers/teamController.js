import Team from "../models/Team.js";
import TeamRequest from "../models/TeamRequest.js";
import Project from "../models/Project.js";
import { createTeam,myTeams,getTeam } from "../services/teamService.js";

export async function create(req,res){
  try { const team=await createTeam({name:req.body.name,projectId:req.body.project,userId:req.user._id}); res.status(201).json({team}); }
  catch(e){ res.status(400).json({message:e.message}); }
}
export async function mine(req,res){ res.json({teams:await myTeams(req.user._id)}); }
export async function one(req,res){
  const data=await getTeam(req.params.id);
  if(!data.team) return res.status(404).json({message:"Team not found"});
  res.json(data);
}
export async function joinRequest(req,res){
  const team=await Team.findById(req.params.id);
  if(!team) return res.status(404).json({message:"Team not found"});
  if(team.members.some(id=>id.toString()===req.user._id.toString())) return res.status(400).json({message:"Already a member"});
  const project=await Project.findById(team.project);
  if(team.members.length >= project.teamSize) return res.status(400).json({message:"Team is full"});
  const request=await TeamRequest.create({team:team._id,user:req.user._id});
  res.status(201).json({request});
}
export async function updateRequest(req,res){
  const request=await TeamRequest.findById(req.params.requestId).populate("team");
  if(!request) return res.status(404).json({message:"Request not found"});
  if(request.team.owner.toString()!==req.user._id.toString()) return res.status(403).json({message:"Only team owner can decide"});
  if(!["accepted","rejected"].includes(req.body.status)) return res.status(400).json({message:"Invalid status"});
  request.status=req.body.status;
  await request.save();
  if(req.body.status==="accepted"){
    const project=await Project.findById(request.team.project);
    if(request.team.members.length >= project.teamSize) return res.status(400).json({message:"Team is full"});
    if(!request.team.members.some(id=>id.toString()===request.user._id.toString())) request.team.members.push(request.user._id);
    await request.team.save();
    if(!project.members.some(id=>id.toString()===request.user._id.toString())) { project.members.push(request.user._id); await project.save(); }
  }
  res.json({message:`Request ${req.body.status}`});
}
