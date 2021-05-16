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
                                channel.send(`MineCraft Server is on: ${ip}:25565`)
                            })
                        });
                    }else{
                        channel.send("MineCraft Server is not running!")
                    }
                })
                break;
            case "start":
                checkTasks().then(taskData => {
                    if(taskData){
                        getPublicIP(taskData).then((ips) => {
                            ips.forEach((ip) => {
                                channel.send(`MineCraft Server is on: ${ip}:25565`)
                            })
                        });
                    }else{
                        updateService();
                        channel.send("MineCraft Server is PROVISIONING...\nPlease wait 5 minutes to get server information.")
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
                            })
                        });
                    }else{
                        channel.send("MineCraft Server is not running!")
                    }
                })
                break;
            case "status":
                checkTasks().then(taskData => {
                    if(taskData){
                        getPublicIP(taskData).then((ips) => {
                            ips.forEach((ip) => {
                                channel.send(`MineCraft Server is on: ${ip}:25565`)
                            })
                        });
                    }else{
                        channel.send('server is not running.')
                    }
                })
                break;
        }
    }
});

client.login(token);