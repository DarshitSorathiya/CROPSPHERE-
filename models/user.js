const mongoose=require('mongoose');
mongoose.connect(`mongodb://127.0.0.1:27017/userData`);

const userSchema=mongoose.Schema({
    username:String,
    email:String,
    password:String,
    mnumber:Number,
    cpassword:String
})

module.exports=mongoose.model('User',userSchema);