export function requiredFields(fields) {
  return (req,res,next) => {
    const missing=fields.filter(f=>!req.body[f]);
    if(missing.length) return res.status(400).json({message:`Missing fields: ${missing.join(", ")}`});
    next();
  };
}
