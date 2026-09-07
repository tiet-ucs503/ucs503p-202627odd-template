import Project from "../models/Project.js";
export async function listProjects({search,mine,userId}) {
  const filter={};
  if(mine) filter.creator=userId;
  if(search) filter.$or=[{title:{$regex:search,$options:"i"}},{description:{$regex:search,$options:"i"}},{requiredSkills:{$regex:search,$options:"i"}}];
  return Project.find(filter).populate("creator","name college").populate("members","name");
}
export async function getProject(id) {
  return Project.findById(id).populate("creator","name college").populate("members","name email");
}
