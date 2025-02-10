"use client";
import axios from "axios";
import { useEffect, useState } from "react"
import {message} from "antd"
const Main = () => {
    const [url, setUrl] = useState<string>("")
    const [comments, setComments] = useState<any[]>([])
    // useEffect(() => {
    //     console.log(url)
    // }, [url])

    const generateComments = async (url: string) => {
        console.log("url",url)
        try {
        const response = await axios.post(`/api/generateComments?link=${url}`)
        const comments = response.data;
        setComments(comments)
        } catch (error) {
        message.error("Something went wrong");
        console.error(error);
        }
    }

    return (
        <div className="bg-gradient-to-r from-instagram-yellow via-instagram-pink to-instagram-blue h-[100vh] sm:overflow-hidden overflow-y-scroll">
            <h2 className="sm:text-3xl text-xl p-2 font-bold text-center sm:mt-10 mt-5 text-[#525789] wrap">Instagram Comment Generator
            Boost your engagement with witty comments
            </h2>
            <div className="flex justify-center border-[3.5px] border-dashed border-[#525789] sm:w-[70%] w-[90%]  h-[82%] mx-auto sm:mt-10 mt-5 rounded-xl bg-white ">
                <div className="w-[100%] h-[100%] mt-10 mx-10">
                <h2 className="text-x text-[#525789]" ><strong>Enter the link of the post</strong></h2>
                <input placeholder="https://www.instagram.com/p/123456789" onChange={(e) => setUrl(e.target.value)} value={url} className="p-2 border-[1px] border-[#525789] w-[100%] h-[5vh] mx-auto mt-3 rounded-[6px]" type="text"/>
                <div className="flex sm:justify-start justify-center">
                <button onClick={() => generateComments(url)}className="w-[10rem] h-[5vh] mt-3 rounded-[6px] bg-[#525789] text-white active:bg-[#a2a6d0] ">Generate</button>
                </div>
                <div className="mt-10 border-[3px] bg-[#f2f6ff] border-dashed w-[100%] h-[40vh] rounded-xl border-[#525789]">
                    <div className="flex justify-center items-center h-[100%]">
                    <h2 className="p-2 sm:text-3xl text-x text-[#525789]">{url === "" ? "Enter the link of the post" : "Your top 3 comments are "+ <br/> +comments?.map((comment, index) => index+1 + ". " + comment)}</h2>
                    </div>
                </div>
                </div>
            </div>
        </div>
    )
}
export default Main