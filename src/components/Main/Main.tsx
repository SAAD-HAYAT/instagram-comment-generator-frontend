"use client";
import axios from "axios";
import { useEffect, useState } from "react"
// import {message} from "antd"
import { LoadingOutlined } from "@ant-design/icons";
// import { message } from "antd";
import '@ant-design/v5-patch-for-react-19';
import { message } from "antd";
const  Main = () => {
    const [url, setUrl] = useState<string>("")
    const [comments, setComments] = useState<string[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    // useEffect(() => {
    //     console.log(url)
    // }, [url])

    const generateComments = async (url: string) => {
        console.log("url",url)
        try {
        setLoading(true)
        const response = await axios.post(
            'https://improved-dynah-saadhayat-c9ca7781.koyeb.app/api/generate-comments',
            { post_url: url }, // Request body
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            } // Axios config
        );
        console.log("response",response)
        const comments = response.data.comments;
        const extractedComments = [response.data.comments.split(":")[0].trim() + ":",...response.data.comments.match(/"(.*?)"\s*\((.*?)\)/g)?.map((comment:string) => comment.replace(/"/g, ''))]
        setComments(extractedComments)
        } catch (error) {
        message.error("Something went wrong");
        console.error(error);
        }
        finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-gradient-to-r from-instagram-yellow via-instagram-pink to-instagram-blue h-[100vh] sm:overflow-hidden overflow-y-scroll">
            {loading && <div className="flex flex-col justify-center items-center bg-[#91939757] fixed w-[100%] h-[100vh] z-10"><LoadingOutlined  className="sm:text-6xl text-3xl text-[#7f8489] "  spin/> <div className=" text-[#7f8489]">loading ...</div></div>}
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
                    <div className="flex justify-center items-center w-[100%] h-[100%]  overflow-y-scroll">
                        {/* <div> */}
                    {comments.length === 0 ? <h2 className="p-2 sm:text-3xl text-x text-[#525789]">Enter the link of the post</h2> :<p className="p-2 text-xl sm:text-xl text-[#525789] h-[100%]">{<ul>{comments.map((comment:string,index) =><li key={index}> {index>0? index +"."+ comment : comment}</li>)}</ul>}</p>}
                    {/* </div> */}
                    </div>
                </div>
                </div>
            </div>
        </div>
    )
}
export default Main