const socket = io("/", {query: {room: "admin"}});
let ckeditor = null;
$(document).ready(async function() {
    initWS();    
    await getSubmissions();
    
    $("#storyimg").on("change", function() {
        if(this.files[0]){
            $("#btn-upload").prop("disabled", false);
            $(".storyimg-container").html("<img src='" + URL.createObjectURL(this.files[0]) + "' class='img-fluid mb-2' />");
        }
        else{
            $("#btn-upload").prop("disabled", true);
        }
    });
    $("#storyimg-form").on("submit", async function(event) {
        event.preventDefault();
        let sUpdatedFullName = $("#submission-modal .updated-fullname").val();
        let sUpdatedStory = ckeditor.getData().replace('<p>', '').replace('</p>', '');
        let submissionID = $("#submission-modal .id").text();
        let formData = new FormData(this);
        formData.append("sUpdatedFullName", sUpdatedFullName);
        formData.append("sUpdatedStory", sUpdatedStory);
        $("#btn-upload").addClass("uploading");
        await updateSubmission(formData, submissionID, "image");
        $("#btn-upload").removeClass("uploading");
        $(".successfull-upload").addClass("visible");
    });
    $(".btn-save").on("click", async function() {
        let submissionID = $("#submission-modal .id").text();
        let sUpdatedFullName = $("#submission-modal .updated-fullname").val();
        let sUpdatedStory = ckeditor.getData().replace('<p>', '').replace('</p>', '');
        let data = {
            sUpdatedFullName: sUpdatedFullName,
            sUpdatedStory: sUpdatedStory
        };

        await updateSubmission(data, submissionID);
        $("#submission-modal").modal("hide");
    });
    $("#btn-refresh").on("click", function() {
        $.ajax({
            url: "/screen/refresh",
            method: "POST",
            success: function(data) {
                console.log("Screen refreshed!");
            }
        });
    });
    $("#btn-delete").on("click", function() {
        if(confirm("Are you sure you want to delete all the submissions?")){
            $.ajax({
                url: "/submission/delete/all",
                method: "DELETE",
                success: function(data) {
                    getSubmissions();
                }
            });
        }
    });
    let ckeditor = await ClassicEditor.create( document.querySelector('.ckeditor'));
    $("#submission-modal").on("show.bs.modal", function(event) {
        $(".successfull-upload").removeClass("visible");
        $("#btn-upload").prop("disabled", true);
        $(".storyimg-container").html("");
        $("#storyimg").val("");
        $(event.relatedTarget).parents("tr").find("input[type='hidden']").each(function() {
            let name = $(this).attr("name");
            let value = $(this).val();
            
            if(name !== "storyimg"){
                if(name === "updated-story"){
                    ckeditor.setData(value);
                }
                else if(name === "fullname" || name === "updated-fullname"){
                    if(value !== "null"){
                        $("#submission-modal ." + name).val(value);
                    }
                }
                else{
                    $("#submission-modal ." + name).text(value);
                }
            }
            else{
                if(value === "1"){
                    let src = "/postcards/" + $("#submission-modal .id").text() + "/postcard.jpg";
                    $(".storyimg-container").html(`<a href="${src}" target="_blank"><img src="${src}" class="img-fluid mb-2" /></a>`);
                }
            }
        });
    });
});

async function getSubmissions(){
    const submissions = await axios({
        method: "get",
        url: "/submission/all",
        responseType: "json"
    });
    let html = "";
    for (let i = 0; i < submissions.data.length; i++) {
        let dtmCreated = new Date(submissions.data[i].dtmCreated);
        let dtmText = dtmCreated.toLocaleDateString('en-EN', { year: 'numeric', month: 'short', day: 'numeric' }) + " " + dtmCreated.toLocaleTimeString('en-EN', { hour12: false});
        html += "<tr>";
            html += "<td>" + submissions.data[i].id + "</td>";
            html += "<td>" + submissions.data[i].sFullName + "</td>";
            html += "<td>" + dtmText + "</td>";
            html += "<td class='text-center'>" + "<button type='button' class='btn btn-primary' data-bs-toggle='modal' data-bs-target='#submission-modal'>SHOW</button>" + "</td>";
            if(submissions.data[i].bUploadedImg === null || submissions.data[i].bUploadedImg === 0){
                html += "<td><span class='badge text-danger'>NO</span></td>";
            }
            else{
                html += "<td><span class='badge text-success'>YES</span></td>";
            }
            html += "<td><div class='form-check form-switch form-switch-md'>";
            if(submissions.data[i].bVisible === 0){
                html += "<input class='form-check-input switch-visibility' type='checkbox' />";
            }
            else{
                html += "<input class='form-check-input switch-visibility' type='checkbox' checked />";
            }
            html += "</div></td>";

            html += "<td class='text-center'>" + submissions.data[i].iLikesCount + "</td>";
            html += "<input type='hidden' name='id' value='" + submissions.data[i].id + "' />";
            html += "<input type='hidden' name='gender' value='" + submissions.data[i].sGender + "' />";
            html += "<input type='hidden' name='age' value='" + submissions.data[i].iAge + "' />";
            html += "<input type='hidden' name='ethnicity' value='" + submissions.data[i].sEthnicity + "' />";

            // replace apostrophes with escaped apostrophes
            submissions.data[i].sStory = submissions.data[i].sStory.replace(/'/g, "&#39;");
            html += "<input type='hidden' name='story' value='" + submissions.data[i].sStory + "' />";
            if(submissions.data[i].sUpdatedStory){
                submissions.data[i].sUpdatedStory = submissions.data[i].sUpdatedStory.replace(/'/g, "&#39;");
            }
            
            html += "<input type='hidden' name='updated-story' value='" + submissions.data[i].sUpdatedStory + "' />";
            html += "<input type='hidden' name='fullname' value='" + submissions.data[i].sFullName + "' />";
            html += "<input type='hidden' name='updated-fullname' value='" + submissions.data[i].sUpdatedFullName + "' />";
            html += "<input type='hidden' name='storyimg' value='" + submissions.data[i].bUploadedImg + "' />";
        html += "</tr>";
    }
    $("#submissions-table tbody").html(html);
    $(".switch-visibility").on("change", async function() {
        let submissionID = $(this).parents("tr").find("input[name='id']").val();
        let checked = $(this).prop("checked");
        let data = {bVisible: checked ? 1 : 0};
        await updateSubmission(data, submissionID);
    });
}

async function updateSubmission(data, submissionID, sUploadType = "json"){
    let header = {};
    if(sUploadType === "image"){
        header = {"Content-Type": "multipart/form-data"};
    }
    await axios({
        method: "post",
        url: "/submission/"+submissionID,
        data: data,
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
    console.log("Submission updated!");
    await getSubmissions();
}

function initWS(){
    socket.on('connect', () => {
        console.log('Connected to socket!');
    });
    socket.on("update_all_submissions", (data) => {
        getSubmissions();
    });
    socket.on("update_single_submission", (data) => {
        getSubmissions();
    });
    socket.on('disconnect', () => {
        console.log('Disconnected from socket!');
    });
}