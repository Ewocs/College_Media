import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useAuthState } from '../../hooks/useAuthState';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AnalyticsDashboard = () => {
    const { token } = useAuthState();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('/api/admin/analytics', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data.data);
            } catch (err) {
                console.error(err);
                setError('Failed to load analytics.');
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchData();
    }, [token]);

    const processHeatmap = (heatmapData) => {
        if (!heatmapData) return [];
        // Group by hour for simple bar chart
        const hours = Array(24).fill(0).map((_, i) => ({ hour: i, posts: 0 }));
        heatmapData.forEach(item => {
            if (item._id && item._id.hour !== undefined) {
                hours[item._id.hour].posts += item.count;
            }
        });
        return hours;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-bg-primary">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex justify-center items-center h-screen bg-bg-primary">
                <div className="text-red-500 font-semibold">{error || 'No data available'}</div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-bg-primary min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Platform Analytics</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. User Growth */}
                <div className="bg-bg-secondary p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-6">User Growth (Daily)</h2>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.userGrowth}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="users" stroke="#0088FE" strokeWidth={2} name="New Users" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Engagement */}
                <div className="bg-bg-secondary p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-6">User Engagement Distribution</h2>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.engagement}
                                    cx="50%" cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {data.engagement && data.engagement.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Activity Patterns */}
                <div className="bg-bg-secondary p-6 rounded-lg shadow-md col-span-1 lg:col-span-2">
                    <h2 className="text-xl font-semibold mb-6">Activity Patterns (Time of Day - UTC)</h2>
                    <div style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={processHeatmap(data.heatmap)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" label={{ value: 'Hour (0-23)', position: 'insideBottom', offset: -10 }} />
                                <YAxis label={{ value: 'Posts Created', angle: -90, position: 'insideLeft' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="posts" fill="#82ca9d" name="Posts" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;

