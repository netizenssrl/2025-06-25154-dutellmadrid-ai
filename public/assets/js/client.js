const socket = io("/", {query: {room: "client"}});
let UID;
let filteredSubmissions = [], likedSubmissions = [];
$(document).ready(async function() {
    initWS();
    if(localStorage.getItem("dutell_madrid_ai_UID") === null){
        UID = Date.now().toString(36) + Math.random().toString(36).substring(2);
        localStorage.setItem("dutell_madrid_ai_UID", UID);
    }
    else{
        UID = localStorage.getItem("dutell_madrid_ai_UID");
    }
    console.log("UID: " + UID);
    //$("main").css({"min-height": $(window).height() - $("footer").outerHeight() - $("header").outerHeight() + "px"});
    $(".reload-btn").click(function() {
        location.reload();
    });

    //FORM
    $(".navigation-btn").click(async function() {
        var idSection = $(this).attr("idsection");
        $(".radio-input").prop("checked", false);
        if(!$("#"+idSection).is(":visible")){
            $(".app-section").fadeOut(300);
            setTimeout(function(){
                $("#"+idSection).fadeIn(300).css("display", "flex");
                $("body").attr("activeSectionId", idSection);
            },300);
        }
        if(idSection === "book-section"){
            await initBook();
            await axios({
                method: "post",
                url: "/tracking",
                data: {
                    sActionType: "participant_book"
                }
            })
        }
    });
    // FIRST STEP
    $("#agreement-form").validate({
        rules: {
            agreement: {
                required: true
            }
        },
        messages: {
            agreement: {
                required: "Please accept terms and conditions"
            }
        },
        errorPlacement: function(error, element) {
            let elementName = element.attr("name");
            $("#error-" + elementName).html($(error).text());
            $("#error-" + elementName).show();
        },
        submitHandler: function(form) {
            let formObject = serializeForm(form);
            if(!$.isEmptyObject(formObject)){
                if(formObject.agreement === "no"){
                    $("#preform-section").fadeOut(300, function() {
                        $("#agreement-section").fadeIn(300).css("display", "flex");
                    });
                }
                else{
                    $("#preform-section").fadeOut(300, function() {
                        $("#form-section").fadeIn(300).css("display", "flex");
                        $("body").attr("activeSectionId", "form-section");
                    });
                }
            }
        }
    });
    $("input[name='gender']").click(function(){
        if($(this).is(":checked")){
            $("#gender-other").val("");
            $("#genderhidden").val($(this).val());
        }
    });
    $("input[name='genderother']").on("input", function(){
        $("input[name='gender']").prop("checked", false);
        $("#genderhidden").val($(this).val());
    });

    $("#prev-btn").click(function(e) {
        e.preventDefault();
        $("#form-section").fadeOut(300, function() {
            $("#intro-section").fadeIn(300).css("display", "flex");
            $("body").attr("activeSectionId", "intro-section");
        });
    });
    $("#main-form").validate({
        ignore: [],
        rules: {
            genderhidden: {
                required: true
            },
            age: {
                required: true,
            },
            ethnicity: {
                required: true
            },
            story: {
                required: true
            }
        },
        messages: {
            genderhidden: {
                required: "Please select a choice"
            },
            age: {
                required: "Please enter a valid value"
            },
            ethnicity: {
                required: "Please enter a valid value"
            },
            story: {
                required: "Please enter a valid value"
            }
        },
        errorPlacement: function(error, element) {
            let elementName = element.attr("name");
            $("#error-" + elementName).html($(error).text());
            $("#error-" + elementName).show();
        },
        submitHandler: function(form) {
            let formObject = serializeForm(form);
            formObject.sUID = UID;
            console.log(formObject);
            $("#form-section").fadeOut(300, function() {
                $("#thankyou-section").fadeIn(300).css("display", "flex");
            });
            axios({
                method: "post",
                url: "/submission/add",
                data: formObject
            });
        }
    });

    await getLikedSubmissions();
    // BOOK
    await initBook();
    $(".btn-like").click(async function(){
        let submissionId = $(this).attr("submissionid");
        await axios({
            method: "post",
            url: "/submission/like",
            data: {
                submissionId: submissionId,
                sUID: UID
            }
        });
        if($(this).hasClass("active")){
            $(this).removeClass("active");
            likedSubmissions = likedSubmissions.filter(submission => submission.fkIdSubmission != submissionId);
        }
        else{
            $(this).addClass("active");
            likedSubmissions.push({fkIdSubmission: submissionId});
        }
    });

});

$(window).on("resize", async function() {
    await initBook();
});


function initWS(){
    socket.on('connect', () => {
        console.log('Connected to socket!');
    });
    socket.on('update_all_submissions', (data) => {
        window.location.reload();
    });
    socket.on('update_single_submission', (data) => {
        console.log("update_single_submission: ", data);
        updateBook(data);
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from socket!');
    });
}

async function getLikedSubmissions(){
    let likedSubmissionsResponse = await axios({
        method: "get",
        url: `/submission/${UID}`,
        responseType: "json"
    });
    likedSubmissions = likedSubmissionsResponse.data;
    console.log("likedSubmissions: ",likedSubmissions);
}

async function initBook(){
    let submissions = await axios({
        method: "get",
        url: "/submission/all",
        responseType: "json"
    });
    let htmlBook = '<div id="postcard-carousel">';
    let initialPage = 1, submissionFound = false;
    filteredSubmissions = submissions.data.filter(submission => submission.bVisible === 1);
    
    filteredSubmissions.forEach((submission, index) => {
        let sUID = submission.sUID;
        let iLikesCount = submission.iLikesCount;
        let submissionID = submission.id;
        let sFullName = submission.sUpdatedFullName;
        let sStory = submission.sUpdatedStory;
        htmlBook += `<div class="postcard-slide bg-white" submissionid="${submissionID}" suid="${sUID}" page="${index+1}">`;
            htmlBook += '<div class="inner-postcard-slide d-flex flex-column flex-lg-row">';
                htmlBook += `<div class="img-postcard-container">`;
                    htmlBook += `<img src="/postcards/${submissionID}/source.jpg" class="img-postcard" alt="Postcard ${sFullName}" />`;
                htmlBook += '</div>';
                htmlBook += '<div class="p-3 d-flex flex-column justify-content-center postcard-content bg-secondary">';
                    htmlBook += `<h3 class="postcard-title text-center text-primary">${sFullName}</h3>`;
                    htmlBook += `<p class="postcard-story text-center text-primary">${sStory}</p>`;
                htmlBook += '</div>';
            htmlBook += '</div>';
            htmlBook += `<input type="hidden" name="likesCount" value="${iLikesCount}" />`;
            htmlBook += `<input type="hidden" name="submissionId" value="${submissionID}" />`;
        htmlBook += '</div>';
            
        if(sUID === UID){
            submissionFound = true;
            initialPage = index+1;
        }
    });
    htmlBook += '</div>';

    $(".postcard-carousel-container").html(htmlBook);
    let carouselWidth = $(window).width() - 70;
    if($(window).width() >= 768 && $(window).width() < 992){
        carouselWidth = 500;
    }
    let carouselHeight = carouselWidth + (carouselWidth * 0.4);
    if($(window).width() >= 992){
        carouselWidth = 850;
        carouselHeight = carouselWidth * 0.5;
    }
    $('#postcard-carousel').turn({
        autoCenter: true,
        display: 'single',
        width: carouselWidth,
        height: carouselHeight,
        acceleration: true,
        inclination: 50,
        gradients: true,
        page: initialPage, // set the initial page
        elevation: 0,
        when: {
            turned: function(e, page) {
                $("#postcard-carousel").attr("currentpage", page);
                let submissionID = $(".turn-page-wrapper[page="+page+"]").find(".postcard-slide").attr("submissionid");
                let likesCount = $(".turn-page-wrapper[page="+page+"]").find("input[name='likesCount']").val();
                $(".btn-like").attr("submissionid", submissionID);
                $(".btn-like .like-count").text(likesCount);
                console.log("submissionid: " +submissionID );
                selectLikeBtn(submissionID);
            }
        }
    });
    $(".postcard-carousel-arrow.left").off().on("click", function(){
        $("#postcard-carousel").turn("previous");
    });
    $(".postcard-carousel-arrow.right").off().on("click", function(){
        $("#postcard-carousel").turn("next");
    });
    if(submissionFound){
        $(".app-section").hide();
        $("#book-section").show().css("display", "flex");
        
    }

}
async function updateBook(updatedSubmission){
    let iLikesCount = updatedSubmission.iLikesCount;
    let submissionID = updatedSubmission.id;
    let sFullName = updatedSubmission.sUpdatedFullName;
    let sStory = updatedSubmission.sUpdatedStory;
    let exists = filteredSubmissions.some(submission => submission.id === submissionID);
    if(updatedSubmission.bVisible === 1){
        // check if submission already exists
        if(exists){
            $(`.postcard-slide[submissionid="${submissionID}"]`).find(".postcard-title").text(sFullName);
            $(`.postcard-slide[submissionid="${submissionID}"]`).find(".postcard-story").html(sStory);
            $(`.postcard-slide[submissionid="${submissionID}"]`).find("input[name='likesCount']").val(iLikesCount);
            if($(".btn-like").attr("submissionid") == submissionID){
                $(".btn-like .like-count").text(iLikesCount);
            }
        }
        else{
            if(!$("#book-section").is(":visible")){
                await initBook();
            }
        }
    }
}

function selectLikeBtn(submissionId){
    // check if submissionID is in likedSubmissions
    let likedSubmission = likedSubmissions.some(submission => submission.fkIdSubmission == submissionId);
    console.log("likedSubmission: " + likedSubmission, "submissionId: " + submissionId);
    if(likedSubmission){
        $(".btn-like[submissionid='"+submissionId+"']").addClass("active");
    }
    else{
        $(".btn-like[submissionid='"+submissionId+"']").removeClass("active");
    }
}
function serializeForm(form){
    var formArray = $(form).serializeArray();
    var formObject = {};
    $.each(formArray, function(i, v) {
        formObject[v.name] = v.value;
    });
    return formObject;
}
