const { Rcon } = require("rcon-client");
const AWS = require("aws-sdk");
const Discord = require("discord.js")
const axios = require("axios");
const { token, aws_credentials, minecraft } = require("./token.json");

const AWS_CONFIG = new AWS.Config({
    accessKeyId: aws_credentials.AccessKey,
    secretAccessKey: aws_credentials.Secret,
    region: "ap-northeast-1"
})
const ecs = new AWS.ECS(AWS_CONFIG);
const ec2 = new AWS.EC2(AWS_CONFIG);

function checkTasks(){
    return ecs.listTasks({
        cluster: "minecraft"
    }).promise().then(data => {
        if(data.taskArns.length == 0){
            return false;
        }
        let taskIds = data["taskArns"].map(Arns => {
            return Arns.split("/")[2];
        })
        let params = {
            cluster: "minecraft",
            tasks: taskIds
        }
        return ecs.describeTasks(params).promise().then((taskData) => {
            if(taskData["tasks"][0]["lastStatus"] == "RUNNING"){
                return taskData["tasks"][0];
            }else{
                return false;
            }
        })
    });
}
function updateService(){
    let params = {
        desiredCount: 1,
        service: "Server",
        cluster: "minecraft"
    }
    return ecs.updateService(params).promise();
}
function stopService(){
    let params = {
        desiredCount: 0,
        service: "Server",
        cluster: "minecraft"
    }
    return ecs.updateService(params).promise();
}
function getPublicIP(taskData){
    let attachment = taskData.attachments.filter((attachment) => {
        return attachment.status == "ATTACHED" && attachment.type == "ElasticNetworkInterface"
    })[0]
    let ENIs = attachment.details.filter((item) => {
        return item.name == "networkInterfaceId"
    }).map((ENI) => {
        return ENI.value;
    })
    let DescribeENIs = ec2.describeNetworkInterfaces({
        NetworkInterfaceIds: ENIs
    }).promise();
    let PublicIPs = DescribeENIs.then((data) => {
        return data.NetworkInterfaces.map(interface => {
            let primary = interface.PrivateIpAddresses.filter(address => {
                return address.Primary == true;
            })
            return primary[0].Association.PublicIp;
        })
    })
    return PublicIPs;
}

const client = new Discord.Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
    const channel = msg.channel;
    const enterCondition = msg.content.includes(">");
    if(msg.channel.name == "server" && msg.author.tag != client.user.tag && enterCondition){
        const content = msg.content.replace("> ", "")
        switch(content){
            case "info":
                checkTasks().then(taskData => {
                    if(taskData){
                        getPublicIP(taskData).then((ips) => {
                            ips.forEach((ip) => {
                                axios.get(
                                    `https://mcapi.us/server/status?ip=${ip}&port=25565`
                                ).then(({data}) => {
                                    if(data.online){
                                        const message = new Discord.MessageEmbed()
                                            .setColor("#568135")
                                            .setTitle("MineCraft Server Information")
                                            .setURL("https://www.minecraft.net/zh-hant")
                                            .addFields(
                                                {name: "Server IP Address: ", value: `${ip}:25565`, inline: true},
                                                {name: "Online Players", value: data.players.now, inline: true}
                                            )
                                            .setTimestamp()
                                            .setAuthor("MineCraft Server Bot")
                                            .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');
                                        channel.send(message)
                                    }else{
                                        const message = new Discord.MessageEmbed()
                                            .setColor("#568135")
                                            .setTitle("MineCraft Server is PROVISIONING...")
                                            .setTimestamp()
                                            .setDescription("Please wait 5 minutes to get server information.")
                                            .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');
                                        channel.send(message)

                                        channel.send(message)
                                    }
                                })
                            })
                        });
                    }else{
                        const message = new Discord.MessageEmbed()
                            .setColor("#568135")
                            .setTimestamp()
                            .setTitle("MineCraft Server is not running.")
                            .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');

                        channel.send(message)
                    }
                })
                break;
            case "start":
                checkTasks().then(taskData => {
                    if(taskData){
                        getPublicIP(taskData).then((ips) => {
                            ips.forEach((ip) => {
                                const message = new Discord.MessageEmbed()
                                    .setColor("#568135")
                                    .setTimestamp()
                                    .setTitle("MineCraft Server Information")
                                    .setURL("https://www.minecraft.net/zh-hant")
                                    .addFields(
                                        {name: "Server IP Address: ", value: `${ip}:25565`, inline: true}
                                    )
                                    .setAuthor("MineCraft Server Bot")
                                    .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');
                                channel.send(message)
                            })
                        });
                    }else{
                        updateService();
                        const message = new Discord.MessageEmbed()
                            .setColor("#568135")
                            .setTitle("MineCraft Server is PROVISIONING...")
                            .setTimestamp()
                            .setDescription("Please wait 5 minutes to get server information.")
                            .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');
                        channel.send(message)
                    }
                })
                break;
            case "stop":
                checkTasks().then(taskData => {
                    if(taskData){
                        getPublicIP(taskData).then((ips) => {
                            ips.forEach(async (ip) => {
                                const rcon = await Rcon.connect({
                                    host: ip, port: minecraft.port, password: minecraft.password
                                })
                                console.log(await rcon.send("stop"));
                                stopService();
                                rcon.end();
                                const message = new Discord.MessageEmbed()
                                    .setColor("#568135")
                                    .setTimestamp()
                                    .setTitle("MineCraft Server is stopping.")
                                    .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');
        
                                channel.send(message)
                            })
                        });
                    }else{
                        const message = new Discord.MessageEmbed()
                            .setColor("#568135")
                            .setTimestamp()
                            .setTitle("MineCraft Server is not running.")
                            .setFooter('MineCraft Server Bot', 'https://i.imgur.com/3bXl2u1l.png');

                        channel.send(message)
                    }
                })
                break;
        }
    }
});

client.login(token);