const timeoutSecond = 60;
const socket = io("/", {query: {room: "screen"}});
let timeout, 
    pointerPositionX = { start: 0, end: 0 }, 
    swipeEnabled = true, 
    direction = null, 
    filteredSubmissions = [];

const showCursor = false;
let currentSubmissionID = null;

$(document).ready(async function() {
    initWS();
    
    $(".screen-section").hide();
    $("#video-section").show();
    await initBook();
    $(".screen-section").on("click", function(){
        restartApp();
    });    
});

function restartApp(){
    clearTimeout(timeout);
    $("#video-loop").get(0).pause();
    $("#book-section").fadeIn(300, function(){
        $("#video-loop").get(0).currentTime = 0;
    });

    timeout = setTimeout(function(){
        $("#book-section").fadeOut(300, async function(){
            $("#video-loop").get(0).play();
            socket.emit('screen_loopingvideo');
            await initBook();
            //$("#postcard-carousel").turn("page", 3);
        });
    }, timeoutSecond * 1000);
        
}
function initWS(){
    socket.on('connect', () => {
        console.log('Connected to socket!');
    });
    socket.on('update_single_submission', (data) => {
        updateBook(data);
    });
    socket.on('turn_page', (data) => {
        if($("#book-section").is(":visible")){
            restartApp();
            if(swipeEnabled){
                swipeEnabled = false;
                if(data.direction === "prev" && $("#postcard-carousel").attr("currentpage") > 3){
                    $('#postcard-carousel').turn('previous');
                }
                else{
                    swipeEnabled = true;
                }
                if(data.direction === "next"){
                    if(($('#postcard-carousel').turn('pages') - 1) == parseInt($("#postcard-carousel").attr("currentpage"))){
                        $('#postcard-carousel').turn('page', 3);
                    }
                    else{
                        $('#postcard-carousel').turn('next');
                    }
                }
            }
        }
        else{
            restartApp();
            let page = $("#postcard-carousel").attr("currentpage");
            submissionID = $(".turn-page-wrapper[page="+page+"]").find(".postcard-slide").attr("submissionid");
            socket.emit('page_turned', {submissionID: submissionID, bBookVisible: $("#book-section").is(":visible")});
        }
    });
    socket.on("update_all_submissions", async () => {
        await initBook();
        $(".screen-section").hide();
        $("#video-section").show();
    });
    socket.on('refresh_screen', () => {
        window.location.reload();
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from socket!');
    });
}

async function initBook(){
    let submissions = await axios({
        method: "get",
        url: "/submission/all",
        responseType: "json"
    });
    filteredSubmissions = submissions.data.filter(submission => submission.bVisible === 1);
    if(filteredSubmissions.length === 0){
        $("#empty-book-parag").show();
        $(".postcard-carousel-container").hide();
    }
    else{
        $("#empty-book-parag").hide();
        let htmlBook = '<div id="postcard-carousel"><div class="postcard-slide bg-white"></div>';
        filteredSubmissions.forEach(submission => {
            let iLikesCount = submission.iLikesCount;
            let submissionID = submission.id;
            let sFullName = submission.sUpdatedFullName;

            htmlBook += `<div class="postcard-slide content" submissionid="${submissionID}">`;
                htmlBook += '<div class="inner-postcard-slide">';
                    htmlBook += `<p class="like-count">${iLikesCount}</p>`;
                    htmlBook += `<img src="/postcards/${submissionID}/postcard-left.jpg" class="img-postcard" alt="Postcard ${sFullName}" />`;
                htmlBook += '</div>';
            htmlBook += '</div>';
            htmlBook += `<div class="postcard-slide image" submissionid="${submissionID}">`;
                htmlBook += '<div class="inner-postcard-slide">';
                    htmlBook += `<img src="/postcards/${submissionID}/postcard-right.jpg" class="img-postcard" alt="Postcard ${sFullName}" />`;
                htmlBook += '</div>';
            htmlBook += '</div>';
        });
        htmlBook += '</div>';
        $(".postcard-carousel-container").html(htmlBook);
        $(".postcard-carousel-container").show();
    }
    

    $('#postcard-carousel').turn({
        autoCenter: true,
        display: 'double',
        width: 3600,
        height: 1850,
        acceleration: true,
        inclination: 50,
        gradients: !$.isTouch,
        elevation: 0,
        when: {
            turned: function(e, page) {
                $("#postcard-carousel").attr("currentpage", page);
                submissionID = $(".turn-page-wrapper[page="+page+"]").find(".postcard-slide").attr("submissionid");
                socket.emit('page_turned', {submissionID: submissionID, bBookVisible: $("#book-section").is(":visible")});
                setTimeout(function(){
                    swipeEnabled = true;
                }, 300);
            }
        }
    });
    if(filteredSubmissions.length > 0){
        $('#postcard-carousel').turn('next');
    }
    
}

async function updateBook(updatedSubmission){
    let iLikesCount = updatedSubmission.iLikesCount;
    let submissionID = updatedSubmission.id;
    let exists = filteredSubmissions.some(submission => submission.id === submissionID);
    // convert sStory to html
    if(updatedSubmission.bVisible === 1 ){
        // check if submission already exists
        if(exists){
            $(`.postcard-slide[submissionid="${submissionID}"]`).find(".like-count").text(iLikesCount);
        }
        else{
            if(!$("#book-section").is(":visible")){
                await initBook();
            }
        }
    }
}