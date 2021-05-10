const Discord = require("discord.js")
const axios = require("axios");
const { token } = require("./token.json")

const endpoint = "https://api.mcsrvstat.us/2/";
const server = "minecraft.stanma.net:18288";
const client = new Discord.Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
    const channel = msg.channel;
    const enterCondition = msg.content.includes("!!");
    if(msg.channel.name == "server" && msg.author.tag != client.user.tag && enterCondition){
        const content = msg.content.replace("!! ", "")
        switch(content){
            case "info":
                axios.get(`${endpoint}${server}`)
                    .then(({ data }) => {
                        console.log(data)
                        if(data.online){
                            channel.send(`MineCraft Server on: ${server}`);
                        }else{
                            channel.send("MineCraft Server is not running.");
                        }
                    })
                break;
            case "start":
                axios.get(`${endpoint}${server}`)
                    .then(({ data }) => {
                        console.log(data)
                        if(data.online){
                            channel.send("MineCraft Server is running.");
                        }else{
                            // Start Service.
                        }
                    })
                break;
            case "stop":
                axios.get(`${endpoint}${server}`)
                    .then(({ data }) => {
                        console.log(data)
                        if(!data.online){
                            channel.send("MineCraft Server is not running.");
                        }else{
                            // Stop Service.
                        }
                    })
                break;
            case "status":
                axios.get(`${endpoint}${server}`)
                    .then(({ data }) => {
                        console.log(data)
                        if(data.online){
                            channel.send('server is running.')
                        }
                    })
                break;
        }
        console.log(`${msg.author.tag} says: ${msg.content}`)
    }
});

client.login(token);