import Project from "../models/Project.js";
import { listProjects,getProject } from "../services/projectService.js";

export async function getProjects(req,res){
  const projects=await listProjects({search:req.query.search,mine:req.query.mine==="true",userId:req.user?._id});
  res.json({projects});
}
export async function getOneProject(req,res){
  const project=await getProject(req.params.id);
  if(!project) return res.status(404).json({message:"Project not found"});
  res.json({project});
}
export async function createProject(req,res){
  const project=await Project.create({...req.body,creator:req.user._id,members:[req.user._id]});
  res.status(201).json({project});
}
export async function updateProject(req,res){
  const project=await Project.findOneAndUpdate({_id:req.params.id,creator:req.user._id},req.body,{new:true,runValidators:true});
  if(!project) return res.status(404).json({message:"Project not found or not owner"});
  res.json({project});
}
export async function deleteProject(req,res){
  const project=await Project.findOneAndDelete({_id:req.params.id,creator:req.user._id});
  if(!project) return res.status(404).json({message:"Project not found or not owner"});
  res.json({message:"Project deleted"});
}
