const express=require("express");
const Razorpay=require("razorpay");
const bodyParser=require("body-parser");
const dotenv=require("dotenv");
const path=require("path");
const fs=require("fs");
const crypto = require("crypto");
const {validateWebhookSignature}=require('razorpay/dist/utils/razorpay-utils');

const app=express();
const port=8080;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.use(express.static(path.join(__dirname)));
dotenv.config();


const razorpay=new Razorpay({
   key_id:process.env.KEY_ID,
   key_secret:process.env.KEY_SECRET
});

//Function to read data from Json file
const readData=()=>{
    if(fs.existsSync('orders.json')){
        const data=fs.readFileSync('orders.json');
        return JSON.parse(data);
    }
    return [];
};

// Function to write data to JSON file
const writeData=(data)=>{
    fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));
};

//Initialize order.json if it doesn't exist
if(!fs.existsSync('orders.json')){
    writeData([]);
}

// Route to handle order creation
app.post('/create-order', async (req , res)=>{
    try{
        const {amount, currency, receipt, notes}=req.body;
        const options={
            amount:amount*100,
            currency,
            receipt,
            notes,
        };
        console.log("Creating order with:", options);
        const order = await razorpay.orders.create(options);
        //const order=await razorpay.orders.create(options);

  // Read current orders, add new order , and write back to the file      
        const orders=readData();
        orders.push({
            order_id:order.id,
            amount:order.amount,
            currency:order.currency,
            receipt:order.receipt,
            status:"created",
        });
        writeData(orders);
        res.json(order);    //send order details to frontend, including order Id
    }catch (error){
        console.error(error);
        res.status(500).json({error:'Error creating order'});
    }
});

// Route to serve the success page
app.get("/payment-success", (req,res)=>{
    res.sendFile(path.join(__dirname, "success.html"));
});



app.post("/verify-payment", (req, res) => {

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = req.body;

    const generatedSignature = crypto
        .createHmac("sha256", process.env.KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

    if (generatedSignature === razorpay_signature) {

        const orders = readData();

        const order = orders.find(
            o => o.order_id === razorpay_order_id
        );

        if (order) {

            order.status = "paid";
            order.payment_id = razorpay_payment_id;

            writeData(orders);

        }

        return res.json({
            status: "ok"
        });

    } else {

        return res.json({
            status: "verification_failed"
        });

    }

});


app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
});