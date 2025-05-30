const socket = io("/", {query: {room: "ipad"}});
let currentSubmissionID = null, bBookVisible = false;
$(document).ready(async function() {
    initWS();
    $(".btn-navigation.prev").click(function(){
        socket.emit('turn_page', {'direction': 'prev'});
    });
    $(".btn-navigation.next").click(function(){
        socket.emit('turn_page', {'direction': 'next'});
    });
    $(".btn-like").click(async function(){
        if($(this).hasClass("disabled")) return;
        $(this).addClass("disabled");
        await axios({
            method: "post",
            url: "/submission/like",
            data: {
                submissionId: currentSubmissionID,
                sUID: "remote_ipad"
            }
        });
    });
});


function initWS(){
    socket.on('connect', () => {
        console.log('Connected to socket!');
    });
    socket.on("screen_loopingvideo", () => {
        bBookVisible = false;
        toggleLikeBtn();
    });
    socket.on("page_turned", (data) => {
        currentSubmissionID = data.submissionID;
        bBookVisible = data.bBookVisible;
        console.log("currentSubmissionID: " + currentSubmissionID);
        toggleLikeBtn();
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from socket!');
    });
}

function toggleLikeBtn(){
    if(!bBookVisible){
        $(".btn-like").addClass("disabled");
    }
    else{
        $(".btn-like").removeClass("disabled");
    }
}